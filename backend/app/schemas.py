from datetime import datetime
from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    student_id: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=6, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class CourseCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    room_name: str = Field(default="Room A", max_length=80)


class CourseJoin(BaseModel):
    join_code: str = Field(min_length=4, max_length=24)


class SessionCreate(BaseModel):
    course_id: int
    title: str = Field(default="Lecture Attendance", max_length=160)
    mode: Literal["live", "video"] = "live"


class SessionOut(BaseModel):
    id: int
    course_id: int
    course_name: str
    room_name: str
    title: str
    mode: str
    status: str
    started_at: datetime
    closed_at: datetime | None = None

    model_config = {"from_attributes": True}
