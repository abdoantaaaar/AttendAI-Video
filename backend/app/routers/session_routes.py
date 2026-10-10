import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, FaceProfile, Course, CourseEnrollment, AttendanceSession, Attendance
from ..schemas import SessionCreate, SessionOut
from ..auth import require_role
from ..ai_engine import face_engine
from ..runtime import register_hit, clear_session, CONFIRM_HITS

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _owned_session(db: Session, session_id: int, doctor: User) -> AttendanceSession:
    session = db.get(AttendanceSession, session_id)
    if not session or session.created_by != doctor.id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _course_students(db: Session, course_id: int):
    return (
        db.query(User)
        .join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .filter(CourseEnrollment.course_id == course_id, User.role == "student")
        .order_by(User.full_name)
        .all()
    )


@router.post("", response_model=SessionOut)
def create_session(
    payload: SessionCreate,
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    course = db.get(Course, payload.course_id)
    if not course or course.doctor_id != doctor.id:
        raise HTTPException(status_code=404, detail="Course not found or not owned by you")

    session = AttendanceSession(
        course_id=course.id,
        course_name=course.name,
        room_name=course.room_name,
        title=payload.title.strip() or "Lecture Attendance",
        mode=payload.mode,
        created_by=doctor.id,
        status="open",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[SessionOut])
def list_sessions(
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    return (
        db.query(AttendanceSession)
        .filter(AttendanceSession.created_by == doctor.id)
        .order_by(AttendanceSession.started_at.desc())
        .all()
    )


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: int,
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    return _owned_session(db, session_id, doctor)


def _attendance_payload(db: Session, session: AttendanceSession):
    students = _course_students(db, session.course_id)
    records = db.query(Attendance).filter(Attendance.session_id == session.id).all()
    by_user = {r.user_id: r for r in records}

    rows = []
    for student in students:
        record = by_user.get(student.id)
        rows.append({
            "user_id": student.id,
            "student_id": student.student_id,
            "name": student.full_name,
            "status": "Present" if record else "Absent",
            "check_in_time": record.check_in_time if record else None,
            "confidence": round(record.confidence, 4) if record else None,
            "source": record.source if record else None,
            "enrolled": student.face_profile is not None,
        })
    return rows


@router.get("/{session_id}/attendance")
def session_attendance(
    session_id: int,
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    session = _owned_session(db, session_id, doctor)
    rows = _attendance_payload(db, session)
    present = sum(1 for r in rows if r["status"] == "Present")
    return {
        "session": SessionOut.model_validate(session),
        "present": present,
        "absent": len(rows) - present,
        "total": len(rows),
        "rows": rows,
    }


@router.post("/{session_id}/recognize")
async def recognize_frame(
    session_id: int,
    frame: UploadFile = File(...),
    source: str = Form("live_camera"),
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    session = _owned_session(db, session_id, doctor)
    if session.status != "open":
        raise HTTPException(status_code=409, detail="Session is closed")

    expected_source = "live_camera" if session.mode == "live" else "video_upload"
    if source != expected_source:
        raise HTTPException(status_code=400, detail=f"This session expects {expected_source}")

    profiles = (
        db.query(FaceProfile, User)
        .join(User, User.id == FaceProfile.user_id)
        .join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .filter(
            CourseEnrollment.course_id == session.course_id,
            User.role == "student",
        )
        .all()
    )

    candidates = [
        {
            "user_id": user.id,
            "student_id": user.student_id,
            "name": user.full_name,
            "embedding": face_engine.embedding_from_json(profile.embedding_json),
        }
        for profile, user in profiles
    ]

    if not candidates:
        raise HTTPException(
            status_code=409,
            detail="No enrolled students with face profiles in this course yet",
        )

    raw = await frame.read()
    try:
        result = face_engine.recognize_frame(raw, candidates, f"{session_id}:{source}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Face engine error: {exc}")

    best_per_user = {}
    for face in result["faces"]:
        user_id = face.get("user_id")
        if not user_id:
            face.update({"confirmation_hits": 0, "confirmed": False, "marked": False})
            continue
        previous = best_per_user.get(user_id)
        if previous is None or face["similarity"] > previous["similarity"]:
            best_per_user[user_id] = face

    newly_marked = []
    for user_id, best_face in best_per_user.items():
        hits, avg_score = register_hit(session_id, user_id, best_face["similarity"])
        confirmed = hits >= CONFIRM_HITS
        best_face.update({"confirmation_hits": hits, "confirmed": confirmed, "marked": False})

        if confirmed:
            existing = (
                db.query(Attendance)
                .filter(Attendance.session_id == session_id, Attendance.user_id == user_id)
                .first()
            )
            if existing is None:
                record = Attendance(
                    session_id=session_id,
                    user_id=user_id,
                    confidence=avg_score,
                    source=source,
                )
                db.add(record)
                db.commit()
                best_face["marked"] = True
                newly_marked.append(best_face["name"])

    for face in result["faces"]:
        uid = face.get("user_id")
        if uid and uid in best_per_user and face is not best_per_user[uid]:
            face["confirmation_hits"] = best_per_user[uid].get("confirmation_hits", 0)
            face["confirmed"] = best_per_user[uid].get("confirmed", False)
            face["marked"] = False

    attendance_now = _attendance_payload(db, session)
    result["newly_marked"] = newly_marked
    result["present_count"] = sum(1 for row in attendance_now if row["status"] == "Present")
    result["total_students"] = len(attendance_now)
    return result


@router.post("/{session_id}/close")
def close_session(
    session_id: int,
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    session = _owned_session(db, session_id, doctor)
    session.status = "closed"
    session.closed_at = datetime.utcnow()
    db.commit()
    clear_session(session_id)
    face_engine.reset_session_tracker(f"{session_id}:live_camera")
    face_engine.reset_session_tracker(f"{session_id}:video_upload")
    return {"message": "Session closed", "session_id": session_id}


@router.get("/{session_id}/export.csv")
def export_csv(
    session_id: int,
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    session = _owned_session(db, session_id, doctor)
    rows = _attendance_payload(db, session)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "session_id", "course_id", "course_name", "room_name", "mode",
        "student_id", "student_name", "status", "check_in_time", "confidence", "source",
    ])
    for row in rows:
        writer.writerow([
            session.id, session.course_id, session.course_name, session.room_name, session.mode,
            row["student_id"], row["name"], row["status"],
            row["check_in_time"].isoformat() if row["check_in_time"] else "",
            row["confidence"] if row["confidence"] is not None else "",
            row["source"] or "",
        ])

    buffer.seek(0)
    headers = {"Content-Disposition": f'attachment; filename="attendance_session_{session_id}.csv"'}
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv", headers=headers)
