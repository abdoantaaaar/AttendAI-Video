import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Camera, Users, LogOut, UserRoundCheck } from 'lucide-react'
import Brand from './Brand'
import { setToken } from '../lib/api'

export default function Layout({ user, children }) {
  const navigate = useNavigate()
  const isDoctor = user?.role === 'doctor'

  function logout() {
    setToken(null)
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="side-nav">
          {isDoctor ? (
            <>
              <NavLink to="/doctor"><LayoutDashboard size={18}/>Overview</NavLink>
              <NavLink to="/doctor"><Users size={18}/>Sessions</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/student"><UserRoundCheck size={18}/>My profile</NavLink>
              <NavLink to="/student/enroll"><Camera size={18}/>Face enrollment</NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{user?.full_name?.[0] || 'U'}</div>
            <div><strong>{user?.full_name}</strong><span>{user?.role}</span></div>
          </div>
          <button className="ghost-btn full" onClick={logout}><LogOut size={17}/>Sign out</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  )
}
