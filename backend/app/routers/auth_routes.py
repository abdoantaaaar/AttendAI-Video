from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import RegisterRequest, LoginRequest, TokenResponse
from ..auth import hash_password, verify_password, create_access_token, current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


def public_user(user: User):
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "student_id": user.student_id,
        "role": user.role,
        "has_face_profile": user.face_profile is not None,
    }


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(User).filter(User.student_id == payload.student_id).first():
        raise HTTPException(status_code=409, detail="Student ID already registered")

    user = User(
        full_name=payload.full_name.strip(),
        email=payload.email.lower(),
        student_id=payload.student_id.strip(),
        role="student",
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user),
        user=public_user(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return TokenResponse(
        access_token=create_access_token(user),
        user=public_user(user),
    )


@router.get("/me")
def me(user: User = Depends(current_user)):
    return public_user(user)
