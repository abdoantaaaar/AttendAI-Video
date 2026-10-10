# AttendAI v2 — Portfolio Notes

## Problem
Traditional attendance is repetitive and easy to manipulate. AttendAI links face recognition to a real course roster instead of recognizing every account in the system.

## Architecture

Student → Public student registration → Course join code → Face reference → FaceNet embedding

Doctor → Institution-issued login → Own courses → Attendance session → Camera/video frames → MTCNN → ByteTrack → FaceNet → Course-scoped cosine search → Multi-frame confirmation → SQLite → CSV

## Strong portfolio points
- Role-based auth where public registration is student-only.
- Course ownership and join-code enrollment.
- Recognition candidates are filtered by course before inference matching.
- Two capture modes: live camera and prerecorded video demo.
- No-mirror camera handling for predictable UI and image capture.
- Face reference can be created from uploaded images.
- Present and absent roster export.
- Duplicate attendance prevented by a database unique constraint.
- FastAPI + React separation and Swagger API docs.
