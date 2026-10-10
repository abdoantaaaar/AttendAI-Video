import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ShieldCheck, CircleAlert, ArrowRight, BookOpen, KeyRound, UserRound } from 'lucide-react'
import Layout from '../components/Layout'
import { api } from '../lib/api'

export default function StudentDashboard({ user }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [courses, setCourses] = useState([])
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    try {
      const [s, c] = await Promise.all([api('/api/enrollment/me'), api('/api/courses/mine')])
      setStatus(s); setCourses(c)
    } catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [])

  async function join(e) {
    e.preventDefault(); setError(''); setMessage('')
    try {
      const data = await api('/api/courses/join', { method: 'POST', body: JSON.stringify({ join_code: joinCode }) })
      setMessage(`Joined ${data.course.name} with ${data.course.doctor_name}.`)
      setJoinCode(''); await load()
    } catch (err) { setError(err.message) }
  }

  return (
    <Layout user={user}>
      <header className="page-header"><div><span className="eyebrow">Student workspace</span><h1>Hello, {user.full_name.split(' ')[0]}.</h1><p>Join your doctor's course once, enroll your face once, then attendance is automatic.</p></div></header>

      {error && <div className="error-box roomy">{error}</div>}
      {message && <div className="success-box roomy">{message}</div>}

      <section className="student-hero content-card">
        <div className={`profile-status ${status?.enrolled ? 'ready' : 'pending'}`}>
          <div className="status-orb">{status?.enrolled ? <ShieldCheck size={32}/> : <CircleAlert size={32}/>}</div>
          <div><span className="eyebrow">Face profile</span><h2>{status?.enrolled ? 'Recognition ready' : 'Enrollment required'}</h2><p>{status?.enrolled ? `${status.sample_count} reference sample(s) are stored as one FaceNet embedding.` : 'Add at least one clear reference image. 3–8 samples are recommended.'}</p></div>
          <button className="primary-btn auto" onClick={() => navigate('/student/enroll')}><Camera size={18}/>{status?.enrolled ? 'Update face profile' : 'Set up face profile'}<ArrowRight size={16}/></button>
        </div>
      </section>

      <section className="dashboard-grid two-dashboard">
        <div className="content-card">
          <div className="section-head"><div><span className="eyebrow">Course access</span><h2>Join a course</h2></div><KeyRound size={21}/></div>
          <p className="muted paragraph-gap">Your doctor shares a join code. This is what connects your account to the correct doctor and attendance roster.</p>
          <form className="join-form" onSubmit={join}>
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="Example: CV-MAYA-26" required />
            <button className="primary-btn auto">Join course</button>
          </form>
        </div>

        <div className="content-card">
          <div className="section-head"><div><span className="eyebrow">My learning spaces</span><h2>{courses.length} joined course{courses.length === 1 ? '' : 's'}</h2></div><BookOpen size={21}/></div>
          <div className="course-list compact-list">
            {courses.length === 0 ? <div className="empty-mini">No courses yet. Ask your doctor for the join code.</div> : courses.map(course => (
              <div className="course-mini" key={course.id}>
                <div className="course-symbol"><BookOpen size={18}/></div>
                <div><strong>{course.name}</strong><span><UserRound size={12}/> {course.doctor_name} · {course.room_name}</span></div>
                <code>{course.join_code}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="explain-grid top-gap">
        <div className="content-card"><span className="step-number">01</span><h3>Join your course</h3><p>Use the code from your doctor. You are never added to every doctor's roster automatically.</p></div>
        <div className="content-card"><span className="step-number">02</span><h3>Enroll once</h3><p>Your images are converted into a normalized 512-D face embedding.</p></div>
        <div className="content-card"><span className="step-number">03</span><h3>Attend normally</h3><p>The doctor starts a course session and the system records only students enrolled in that course.</p></div>
      </section>
    </Layout>
  )
}
