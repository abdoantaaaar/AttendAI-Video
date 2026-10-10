import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine, SessionLocal
from .seed import seed_demo_data
from .routers import auth_routes, enrollment_routes, session_routes, dashboard_routes, course_routes

load_dotenv()

app = FastAPI(
    title="AttendAI API",
    version="2.0.0",
    description="Course-scoped AI attendance with MTCNN, FaceNet and ByteTrack",
)

origins = [
    item.strip()
    for item in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if item.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(course_routes.router)
app.include_router(enrollment_routes.router)
app.include_router(session_routes.router)
app.include_router(dashboard_routes.router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AttendAI", "version": "2.0.0"}
