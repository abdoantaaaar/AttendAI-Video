import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ScanFace, CalendarDays, UserCheck, Plus, ArrowUpRight, Radio, BookOpen, Copy, Video, Camera } from 'lucide-react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import { api } from '../lib/api'
import { ATTENDANCE_MODE, MODE_LABEL } from '../config'

export default function DoctorDashboard({ user }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ courses: 0, students: 0, enrolled_faces: 0, sessions: 0, checkins_today: 0 })
  const [courses, setCourses] = useState([])
  const [sessions, setSessions] = useState([])
  const [showCreateCourse, setShowCreateCourse] = useState(false)
  const [courseForm, setCourseForm] = useState({ name: 'Computer Vision', room_name: 'Lab 3' })
  const [sessionCourse, setSessionCourse] = useState(null)
  const [sessionTitle, setSessionTitle] = useState('Lecture Attendance')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  async function load() {
    try {
      const [s, c, list] = await Promise.all([api('/api/dashboard/stats'), api('/api/courses/mine'), api('/api/sessions')])
      setStats(s); setCourses(c); setSessions(list)
    } catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [])

  async function createCourse(e) {
    e.preventDefault(); setError('')
    try {
      await api('/api/courses', { method: 'POST', body: JSON.stringify(courseForm) })
      setShowCreateCourse(false); await load()
    } catch (err) { setError(err.message) }
  }

  async function createSession(e) {
    e.preventDefault(); setError('')
    try {
      const session = await api('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ course_id: sessionCourse.id, title: sessionTitle, mode: ATTENDANCE_MODE }),
      })
      setSessionCourse(null); await load(); navigate(`/doctor/session/${session.id}`)
    } catch (err) { setError(err.message) }
  }

  async function copyCode(code) {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(''), 1600) }
    catch { setCopied('Copy manually') }
  }

  return (
    <Layout user={user}>
      <header className="page-header">
        <div><span className="eyebrow">Doctor workspace · {MODE_LABEL}</span><h1>Good morning, {user.full_name.split(' ')[0]}.</h1><p>Your students join one of your courses by code. Attendance never scans unrelated accounts.</p></div>
        <button className="primary-btn auto" onClick={() => setShowCreateCourse(true)}><Plus size={18}/>New course</button>
      </header>

      {error && <div className="error-box roomy">{error}</div>}
      {copied && <div className="toast-success">{copied === 'Copy manually' ? copied : `Copied ${copied}`}</div>}

      <section className="stats-grid">
        <StatCard label="My courses" value={stats.courses} icon={BookOpen} hint="Owned by this doctor" />
        <StatCard label="My students" value={stats.students} icon={Users} hint="Unique joined students" />
        <StatCard label="Face profiles" value={stats.enrolled_faces} icon={ScanFace} hint="Recognition ready" />
        <StatCard label="Check-ins today" value={stats.checkins_today} icon={UserCheck} hint="Verified attendance" />
      </section>

      <section className="content-card course-section">
        <div className="section-head"><div><span className="eyebrow">Teaching spaces</span><h2>My courses</h2></div><span className="mode-chip">{ATTENDANCE_MODE === 'live' ? <Camera size={14}/> : <Video size={14}/>} {MODE_LABEL}</span></div>
        <div className="course-grid">
          {courses.length === 0 ? <div className="empty-state"><BookOpen size={28}/><h3>No courses yet</h3><p>Create a course and share its join code with your students.</p></div> : courses.map(course => (
            <article className="course-card" key={course.id}>
              <div className="course-card-top"><div className="course-symbol"><BookOpen size={20}/></div><span>{course.student_count} students</span></div>
              <h3>{course.name}</h3><p>{course.room_name} · {course.doctor_name}</p>
              <button className="join-code" onClick={() => copyCode(course.join_code)} title="Copy join code"><span>Join code</span><strong>{course.join_code}</strong><Copy size={15}/></button>
              <button className="primary-btn full-width" onClick={() => { setSessionCourse(course); setSessionTitle('Lecture Attendance') }}><Radio size={17}/>Start attendance</button>
            </article>
          ))}
        </div>
      </section>

      <section className="content-card top-gap">
        <div className="section-head"><div><span className="eyebrow">Recent sessions</span><h2>Attendance history</h2></div></div>
        <div className="session-list">
          {sessions.length === 0 ? <div className="empty-state"><Radio size={28}/><h3>No sessions yet</h3><p>Start attendance from one of your course cards.</p></div> : sessions.map(session => (
            <button className="session-row" key={session.id} onClick={() => navigate(`/doctor/session/${session.id}`)}>
              <div className="session-icon"><Radio size={18}/></div>
              <div className="session-main"><strong>{session.course_name}</strong><span>{session.title} · {session.room_name} · {session.mode}</span></div>
              <span className={`status-pill ${session.status}`}>{session.status}</span>
              <time>{new Date(session.started_at).toLocaleString()}</time><ArrowUpRight size={18}/>
            </button>
          ))}
        </div>
      </section>

      {showCreateCourse && <div className="modal-backdrop" onMouseDown={() => setShowCreateCourse(false)}>
        <form className="modal-card" onSubmit={createCourse} onMouseDown={e => e.stopPropagation()}>
          <div><span className="eyebrow">New course</span><h2>Create teaching space</h2><p>A unique join code is generated automatically. Share it only with students in this course.</p></div>
          <label>Course name<input value={courseForm.name} onChange={e => setCourseForm({...courseForm, name: e.target.value})} required /></label>
          <label>Room<input value={courseForm.room_name} onChange={e => setCourseForm({...courseForm, room_name: e.target.value})} required /></label>
          <div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setShowCreateCourse(false)}>Cancel</button><button className="primary-btn auto">Create course</button></div>
        </form>
      </div>}

      {sessionCourse && <div className="modal-backdrop" onMouseDown={() => setSessionCourse(null)}>
        <form className="modal-card" onSubmit={createSession} onMouseDown={e => e.stopPropagation()}>
          <div><span className="eyebrow">{MODE_LABEL}</span><h2>Start {sessionCourse.name}</h2><p>{ATTENDANCE_MODE === 'live' ? 'The next screen opens the room camera.' : 'The next screen lets you upload a prerecorded classroom video.'}</p></div>
          <label>Session title<input value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} required /></label>
          <div className="session-summary"><span>Course</span><strong>{sessionCourse.name}</strong><span>Students</span><strong>{sessionCourse.student_count}</strong></div>
          <div className="modal-actions"><button type="button" className="ghost-btn" onClick={() => setSessionCourse(null)}>Cancel</button><button className="primary-btn auto">Create & open</button></div>
        </form>
      </div>}
    </Layout>
  )
}
