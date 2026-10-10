from datetime import datetime
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import FaceProfile, User
from ..auth import require_role
from ..ai_engine import face_engine

router = APIRouter(prefix="/api/enrollment", tags=["enrollment"])


@router.get("/me")
def enrollment_status(user: User = Depends(require_role("student"))):
    profile = user.face_profile
    return {
        "enrolled": profile is not None,
        "sample_count": profile.sample_count if profile else 0,
        "updated_at": profile.updated_at if profile else None,
    }


@router.post("/me")
async def enroll_me(
    files: list[UploadFile] = File(...),
    user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    if len(files) < 1:
        raise HTTPException(status_code=400, detail="Please provide at least one face image")

    payloads = [await f.read() for f in files[:8]]
    try:
        embedding, sample_count = face_engine.enroll_images(payloads, min_samples=1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Face engine error: {exc}")

    profile = db.query(FaceProfile).filter(FaceProfile.user_id == user.id).first()
    if profile is None:
        profile = FaceProfile(user_id=user.id, embedding_json="[]")
        db.add(profile)

    profile.embedding_json = face_engine.embedding_to_json(embedding)
    profile.sample_count = sample_count
    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    return {
        "message": "Face profile saved successfully",
        "sample_count": profile.sample_count,
        "updated_at": profile.updated_at,
    }
