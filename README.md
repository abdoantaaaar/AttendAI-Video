# This edition: Video demo

# AttendAI v2 — Course-Scoped AI Attendance

AttendAI v2 is a portfolio-ready full-stack attendance system built with **React + FastAPI + SQLite + MTCNN + FaceNet + ByteTrack**.

## What changed in v2

The flow is now realistic:

```text
Institution / demo seed
        ↓
Doctor account (NOT public registration)
        ↓
Doctor creates Course
        ↓
System generates Join Code
        ↓
Student creates Student account
        ↓
Student joins that specific Course using the code
        ↓
Student creates one Face Profile
        ↓
Doctor starts Attendance Session for that Course
        ↓
Only that Course's enrolled students are recognition candidates
        ↓
Present / Absent + CSV
```

This means a student is not automatically attached to every doctor, and public registration can never create a doctor account.

## AI stack

- MTCNN: face detection / face crop preparation
- InceptionResnetV1 pretrained on VGGFace2: 512-D embeddings
- Cosine similarity: identity matching
- ByteTrack: temporary multi-face tracking
- 3 matching observations: attendance confirmation
- Unique `(session_id, user_id)`: no duplicate check-in

## Two editions

This package is released as two separate folders/zips:

1. **Real-time edition** — doctor opens the room camera. Student face setup supports camera capture or image upload. Camera preview/capture uses normal orientation with no CSS or canvas mirror transform.
2. **Video demo edition** — doctor uploads a prerecorded classroom video instead of opening a camera. Student face setup is image-upload based, so you can demo the project without showing your own face live.

Both editions use the same backend security and course logic.

## Database

Default database: `backend/attendance_v2.db`

Tables:
- `users`
- `face_profiles`
- `courses`
- `course_enrollments`
- `attendance_sessions`
- `attendance`

## Run backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Backend: `http://localhost:8000`
Swagger: `http://localhost:8000/docs`

## Run frontend

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Frontend: `http://localhost:5173`

## Demo accounts

### Doctors (institution-issued demo accounts)

```text
doctor@demo.com
Doctor123!
```

```text
omar.doctor@demo.com
Doctor123!
```

### Students

All seeded students use `Student123!`:

```text
karim@demo.com
ahmed@demo.com
sara@demo.com
mona@demo.com
```

### Demo course codes

```text
CV-MAYA-26  → Computer Vision / Dr. Maya Hassan
AI-OMAR-26  → Applied AI / Dr. Omar Adel
```

A newly registered student can join either course by entering its join code.

## Real demo sequence

1. Start backend and frontend.
2. Register a new student or use a seeded student.
3. Student enters a doctor-provided course code.
4. Student opens Face Reference and adds 1–8 reference images (3–8 recommended).
5. Sign in as the doctor.
6. Open the matching course and start attendance.
7. Real-time edition: start room camera.
8. Video edition: upload a classroom video and click Play & process.
9. Recognition is restricted to students enrolled in that course.
10. After 3 matching observations, the student is marked Present once.
11. Export the full course roster as CSV, including Absent students.

## Important demo note

For a prerecorded random video, the reference photo for a student must show the same person who appears in the video. You can use demo aliases instead of real names.
