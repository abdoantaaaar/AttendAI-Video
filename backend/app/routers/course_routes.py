import secrets
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Course, CourseEnrollment, FaceProfile, User
from ..schemas import CourseCreate, CourseJoin
from ..auth import current_user, require_role

router = APIRouter(prefix="/api/courses", tags=["courses"])

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _new_code(db: Session, course_name: str) -> str:
    prefix = "".join(ch for ch in course_name.upper() if ch.isalnum())[:3] or "CRS"
    for _ in range(30):
        suffix = "".join(secrets.choice(ALPHABET) for _ in range(5))
        code = f"{prefix}-{suffix}"
        if not db.query(Course).filter(Course.join_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="Could not generate course code")


def course_payload(course: Course, db: Session) -> dict:
    doctor = db.get(User, course.doctor_id)
    count = db.query(CourseEnrollment).filter(CourseEnrollment.course_id == course.id).count()
    return {
        "id": course.id,
        "name": course.name,
        "join_code": course.join_code,
        "room_name": course.room_name,
        "doctor_id": course.doctor_id,
        "doctor_name": doctor.full_name if doctor else "Unknown doctor",
        "student_count": count,
        "created_at": course.created_at,
    }


@router.get("/mine")
def mine(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role == "doctor":
        courses = db.query(Course).filter(Course.doctor_id == user.id).order_by(Course.created_at.desc()).all()
    elif user.role == "student":
        courses = (
            db.query(Course)
            .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
            .filter(CourseEnrollment.student_id == user.id)
            .order_by(Course.name)
            .all()
        )
    else:
        courses = []
    return [course_payload(c, db) for c in courses]


@router.post("")
def create_course(
    payload: CourseCreate,
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    course = Course(
        name=payload.name.strip(),
        room_name=payload.room_name.strip() or "Room A",
        doctor_id=doctor.id,
        join_code=_new_code(db, payload.name),
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course_payload(course, db)


@router.post("/join")
def join_course(
    payload: CourseJoin,
    student: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    code = payload.join_code.strip().upper()
    course = db.query(Course).filter(Course.join_code == code).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course code not found")

    existing = (
        db.query(CourseEnrollment)
        .filter(
            CourseEnrollment.course_id == course.id,
            CourseEnrollment.student_id == student.id,
        )
        .first()
    )
    if existing is None:
        db.add(CourseEnrollment(course_id=course.id, student_id=student.id))
        db.commit()

    return {"message": "Joined course", "course": course_payload(course, db)}


@router.get("/{course_id}/students")
def course_students(
    course_id: int,
    doctor: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    course = db.get(Course, course_id)
    if not course or course.doctor_id != doctor.id:
        raise HTTPException(status_code=404, detail="Course not found")

    students = (
        db.query(User)
        .join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .filter(CourseEnrollment.course_id == course.id)
        .order_by(User.full_name)
        .all()
    )
    return [
        {
            "id": s.id,
            "full_name": s.full_name,
            "student_id": s.student_id,
            "email": s.email,
            "face_ready": s.face_profile is not None,
        }
        for s in students
    ]
