import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Sparkles, GraduationCap, Stethoscope } from 'lucide-react'
import Brand from '../components/Brand'
import { api, setToken } from '../lib/api'
import { MODE_LABEL } from '../config'

export default function LoginPage({ onUser }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('doctor@demo.com')
  const [password, setPassword] = useState('Doctor123!')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function useDoctorDemo() { setEmail('doctor@demo.com'); setPassword('Doctor123!') }
  function useStudentDemo() { setEmail('karim@demo.com'); setPassword('Student123!') }

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setToken(data.access_token)
      onUser(data.user)
      navigate(data.user.role === 'doctor' ? '/doctor' : '/student')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <div className="eyebrow"><Sparkles size={15}/> {MODE_LABEL}</div>
          <h1>Attendance tied to real courses, not random accounts.</h1>
          <p>Students join a specific course with a code from their doctor. Face enrollment happens once; attendance is then verified automatically.</p>
          <div className="story-points">
            <span><ShieldCheck size={17}/> Course-scoped roster</span>
            <span><ShieldCheck size={17}/> Institution-issued doctor accounts</span>
            <span><ShieldCheck size={17}/> Multi-frame face confirmation</span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div><span className="eyebrow">Secure access</span><h2>Sign in to AttendAI</h2><p>Students can self-register. Doctor accounts are provisioned by the institution.</p></div>
          <label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" required /></label>
          <label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" required /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn" disabled={loading}>{loading ? 'Signing in…' : <>Sign in <ArrowRight size={17}/></>}</button>
          <div className="demo-actions">
            <button type="button" className="demo-choice" onClick={useDoctorDemo}><Stethoscope size={17}/><span><strong>Doctor demo</strong><small>Dr. Maya · Computer Vision</small></span></button>
            <button type="button" className="demo-choice" onClick={useStudentDemo}><GraduationCap size={17}/><span><strong>Student demo</strong><small>Karim · joined to CV course</small></span></button>
          </div>
          <p className="center muted">New student? <Link to="/register">Create student account</Link></p>
        </form>
      </section>
    </div>
  )
}
