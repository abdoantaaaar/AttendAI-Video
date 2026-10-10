from sqlalchemy.orm import Session
from .models import User, Course, CourseEnrollment
from .auth import hash_password


def _user(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def seed_demo_data(db: Session):
    doctors = [
        ("Dr. Maya Hassan", "doctor@demo.com", "Doctor123!"),
        ("Dr. Omar Adel", "omar.doctor@demo.com", "Doctor123!"),
    ]
    for name, email, password in doctors:
        if _user(db, email) is None:
            db.add(User(
                full_name=name,
                email=email,
                role="doctor",
                password_hash=hash_password(password),
            ))
    db.commit()

    students = [
        ("Karim Adel", "karim@demo.com", "STU-001"),
        ("Ahmed Samir", "ahmed@demo.com", "STU-002"),
        ("Sara Mostafa", "sara@demo.com", "STU-003"),
        ("Mona Youssef", "mona@demo.com", "STU-004"),
    ]
    for name, email, student_id in students:
        if _user(db, email) is None:
            db.add(User(
                full_name=name,
                email=email,
                student_id=student_id,
                role="student",
                password_hash=hash_password("Student123!"),
            ))
    db.commit()

    maya = _user(db, "doctor@demo.com")
    omar = _user(db, "omar.doctor@demo.com")

    cv = db.query(Course).filter(Course.join_code == "CV-MAYA-26").first()
    if cv is None:
        cv = Course(name="Computer Vision", join_code="CV-MAYA-26", room_name="Vision Lab 3", doctor_id=maya.id)
        db.add(cv)

    ai = db.query(Course).filter(Course.join_code == "AI-OMAR-26").first()
    if ai is None:
        ai = Course(name="Applied AI", join_code="AI-OMAR-26", room_name="AI Lab 1", doctor_id=omar.id)
        db.add(ai)

    db.commit()
    db.refresh(cv)
    db.refresh(ai)

    for email in ["karim@demo.com", "ahmed@demo.com", "sara@demo.com"]:
        student = _user(db, email)
        exists = db.query(CourseEnrollment).filter(
            CourseEnrollment.course_id == cv.id,
            CourseEnrollment.student_id == student.id,
        ).first()
        if exists is None:
            db.add(CourseEnrollment(course_id=cv.id, student_id=student.id))

    mona = _user(db, "mona@demo.com")
    exists = db.query(CourseEnrollment).filter(
        CourseEnrollment.course_id == ai.id,
        CourseEnrollment.student_id == mona.id,
    ).first()
    if exists is None:
        db.add(CourseEnrollment(course_id=ai.id, student_id=mona.id))

    db.commit()
