import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DoctorDashboard from './pages/DoctorDashboard'
import AttendancePage from './pages/AttendancePage'
import StudentDashboard from './pages/StudentDashboard'
import EnrollmentPage from './pages/EnrollmentPage'
import { api, getToken } from './lib/api'

function Protected({ user, role, children }) {
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'doctor' ? '/doctor' : '/student'} replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  async function refreshUser() {
    if (!getToken()) return null
    const me = await api('/api/auth/me')
    setUser(me)
    return me
  }

  useEffect(() => {
    if (!getToken()) return setChecking(false)
    refreshUser().catch(() => setUser(null)).finally(() => setChecking(false))
  }, [])

  if (checking) return <div className="boot-screen">AttendAI</div>

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onUser={setUser} />} />
      <Route path="/register" element={<RegisterPage onUser={setUser} />} />
      <Route path="/doctor" element={<Protected user={user} role="doctor"><DoctorDashboard user={user} /></Protected>} />
      <Route path="/doctor/session/:id" element={<Protected user={user} role="doctor"><AttendancePage user={user} /></Protected>} />
      <Route path="/student" element={<Protected user={user} role="student"><StudentDashboard user={user} /></Protected>} />
      <Route path="/student/enroll" element={<Protected user={user} role="student"><EnrollmentPage user={user} refreshUser={refreshUser} /></Protected>} />
      <Route path="*" element={<Navigate to={user ? (user.role === 'doctor' ? '/doctor' : '/student') : '/login'} replace />} />
    </Routes>
  )
}
