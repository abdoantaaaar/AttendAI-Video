from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, FaceProfile, Course, CourseEnrollment, AttendanceSession, Attendance
from ..auth import require_role

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def stats(
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    course_ids = [c.id for c in db.query(Course).filter(Course.doctor_id == doctor.id).all()]
    if course_ids:
        student_ids = [
            row[0] for row in (
                db.query(CourseEnrollment.student_id)
                .filter(CourseEnrollment.course_id.in_(course_ids))
                .distinct()
                .all()
            )
        ]
    else:
        student_ids = []

    students = len(student_ids)
    enrolled_faces = (
        db.query(FaceProfile).filter(FaceProfile.user_id.in_(student_ids)).count()
        if student_ids else 0
    )
    sessions = db.query(AttendanceSession).filter(AttendanceSession.created_by == doctor.id).count()

    today = datetime.utcnow().date()
    start = datetime.combine(today, datetime.min.time())
    end = start + timedelta(days=1)
    session_ids = [
        row[0] for row in db.query(AttendanceSession.id).filter(AttendanceSession.created_by == doctor.id).all()
    ]
    checkins_today = (
        db.query(Attendance)
        .filter(
            Attendance.session_id.in_(session_ids),
            Attendance.check_in_time >= start,
            Attendance.check_in_time < end,
        )
        .count()
        if session_ids else 0
    )

    return {
        "courses": len(course_ids),
        "students": students,
        "enrolled_faces": enrolled_faces,
        "sessions": sessions,
        "checkins_today": checkins_today,
    }
