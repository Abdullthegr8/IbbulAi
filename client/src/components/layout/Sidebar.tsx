import { NavLink, useNavigate } from 'react-router-dom'
import { Home, MessageCircle, Files, Info, ShieldCheck, LogOut, LayoutDashboard, X, GraduationCap, Briefcase } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { to: '/home',      label: 'Home',      icon: Home },
  { to: '/chat',      label: 'Chat',      icon: MessageCircle },
  { to: '/documents', label: 'Documents', icon: Files },
  { to: '/about',     label: 'About',     icon: Info },
]

interface Props { open: boolean; onClose: () => void }

export default function Sidebar({ open, onClose }: Props) {
  const { isAdmin, isLoggedIn, user, logout } = useAuth()
  const isStaff   = user?.role === 'staff'
  const isStudent = user?.role === 'student'
  const navigate  = useNavigate()

  function handleLogout() { logout(); navigate('/'); onClose() }

  const RoleIcon = isStudent ? GraduationCap : isStaff ? Briefcase : ShieldCheck

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[240px] flex-shrink-0 flex flex-col h-full
          transform transition-transform duration-250 ease-in-out lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#1A6B1A' }}>

        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="IBBU Logo" className="w-10 h-10 rounded-full object-cover bg-white p-0.5 shadow flex-shrink-0" />
            <div>
              <div className="text-white font-display font-bold text-[14px] leading-tight">IbbulAI</div>
              <div className="text-white/50 text-[10px] mt-0.5">IBBU Intelligent Assistant</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-2 pb-2">Main Menu</p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors
                 ${isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={17} />{label}
            </NavLink>
          ))}

          {(!isLoggedIn || isAdmin || isStaff) && (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-2 pt-5 pb-2">Administration</p>
              {isAdmin && (
                <NavLink to="/admin" onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors
                     ${isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  <LayoutDashboard size={17} />Dashboard
                </NavLink>
              )}
              {isStaff && (
                <NavLink to="/admin" onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors
                     ${isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                  <Briefcase size={17} />Staff Panel
                </NavLink>
              )}
              {!isLoggedIn && (
                <>
                  <NavLink to="/staff/login" onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors
                       ${isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                    <Briefcase size={17} />Staff Portal
                  </NavLink>
                  <NavLink to="/admin/login" onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors
                       ${isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>
                    <ShieldCheck size={17} />Admin Login
                  </NavLink>
                </>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/15">
          {isLoggedIn && user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/10 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(255,255,255,0.2)' }}>
                <RoleIcon size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[12px] font-semibold truncate">{user.name}</p>
                <p className="text-white/50 text-[10px] truncate capitalize">{user.role} · {user.identifier}</p>
              </div>
            </div>
          )}
          {isLoggedIn && (
            <button onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-red-300 hover:bg-white/10 hover:text-red-200 transition-colors w-full">
              <LogOut size={17} />Sign out
            </button>
          )}
          <div className="px-3 pt-3 text-[10px] text-white/25 text-center">
            © {new Date().getFullYear()} IbbulAI · IBB University, Lapai
          </div>
        </div>
      </aside>
    </>
  )
}
