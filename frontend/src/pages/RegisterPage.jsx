import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import Brand from '../components/Brand'
import { api, setToken } from '../lib/api'

export default function RegisterPage({ onUser }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', student_id: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function change(e) { setForm({ ...form, [e.target.name]: e.target.value }) }

  async function submit(e) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(form) })
      setToken(data.access_token); onUser(data.user); navigate('/student')
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="register-page">
      <div className="register-wrap">
        <Brand />
        <form className="auth-card wide" onSubmit={submit}>
          <div><span className="eyebrow">Student onboarding</span><h2>Create student account</h2><p>After registration, enter the join code shared by your doctor to connect to the correct course.</p></div>
          <div className="policy-note"><LockKeyhole size={17}/><span><strong>Doctor accounts are not public.</strong> They are institution-issued and cannot be created from this page.</span></div>
          <div className="two-col">
            <label>Full name<input name="full_name" value={form.full_name} onChange={change} required /></label>
            <label>Student ID<input name="student_id" value={form.student_id} onChange={change} required /></label>
          </div>
          <label>Email<input name="email" type="email" value={form.email} onChange={change} required /></label>
          <label>Password<input name="password" type="password" value={form.password} onChange={change} minLength={6} maxLength={72} required /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-btn" disabled={loading}>{loading ? 'Creating…' : <>Create student account <ArrowRight size={17}/></>}</button>
          <p className="center muted">Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  )
}
