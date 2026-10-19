import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  SquarePen, Home, Files, Info, LayoutDashboard, Briefcase, LogOut, PanelLeftClose, PanelLeftOpen,
  ChevronsUpDown, LogIn, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import ConversationList from '../chat/ConversationList'

interface Props {
  collapsed:  boolean   // desktop icon rail
  mobileOpen: boolean   // mobile drawer
  onToggle:   () => void
  onClose:    () => void
}

const GREEN = '#1A6B1A'

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?'
}

function NavItem({ to, label, icon: Icon, collapsed, onClick }:
  { to: string; label: string; icon: LucideIcon; collapsed: boolean; onClick: () => void }) {
  return (
    <NavLink to={to} onClick={onClick} title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg text-[13px] transition-colors h-9
         ${collapsed ? 'justify-center w-9 mx-auto' : 'px-3'}
         ${isActive ? 'bg-black/[0.06] text-gray-900 font-medium' : 'text-gray-600 hover:bg-black/[0.04] hover:text-gray-900'}`}>
      <Icon size={17} />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

export default function Sidebar({ collapsed: collapsedDesktop, mobileOpen, onToggle, onClose }: Props) {
  const { user, isLoggedIn, isAdmin, isStaff, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // The drawer on mobile is always full width
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const collapsed = isDesktop && collapsedDesktop

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  function newChat() {
    onClose()
    navigate('/chat', { state: { fresh: Date.now() } })
  }

  function signOut() {
    setMenuOpen(false)
    onClose()
    logout()
    navigate('/')
  }

  const nav = [
    { to: '/home',      label: 'Home',      icon: Home },
    { to: '/documents', label: 'Documents', icon: Files },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin dashboard', icon: LayoutDashboard }] : []),
    ...(isStaff ? [{ to: '/admin', label: 'Staff panel',     icon: Briefcase }] : []),
    { to: '/about',     label: 'About',     icon: Info },
  ]

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden animate-fadeIn" onClick={onClose} />}
      <aside
        aria-label="Sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-40 flex-shrink-0 flex flex-col h-full bg-[#f7f7f4] border-r border-black/[0.06]
          transition-[transform,width] duration-200 ease-out lg:translate-x-0
          ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
          ${collapsed ? 'w-[60px]' : 'w-[284px] max-w-[85vw] lg:w-[264px]'}`}>

        {/* Brand + collapse */}
        <div className={`flex items-center h-14 flex-shrink-0 ${collapsed ? 'justify-center' : 'px-3 justify-between'}`}>
          {!collapsed && (
            <Link to="/chat" onClick={onClose} className="flex items-center gap-2 min-w-0 px-1">
              <img src="/logo.png" alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
              <span className="font-display font-bold text-[15px] text-gray-900 truncate">IbbulAI</span>
            </Link>
          )}
          <button onClick={isDesktop ? onToggle : onClose}
                  aria-label={isDesktop ? (collapsed ? 'Expand sidebar' : 'Collapse sidebar') : 'Close menu'}
                  title={isDesktop ? (collapsed ? 'Expand sidebar' : 'Collapse sidebar') : undefined}
                  className="p-2 rounded-lg text-gray-500 hover:bg-black/[0.05] hover:text-gray-800 transition-colors">
            {!isDesktop ? <X size={18} /> : collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* New chat */}
        <div className={`flex-shrink-0 ${collapsed ? 'px-0' : 'px-3'}`}>
          <button onClick={newChat} title={collapsed ? 'New chat' : undefined}
                  className={`flex items-center gap-3 h-9 rounded-lg text-[13px] font-medium transition-colors hover:bg-black/[0.04]
                    ${collapsed ? 'justify-center w-9 mx-auto' : 'w-full px-2'}`}
                  style={{ color: GREEN }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: GREEN }}>
              <SquarePen size={13} />
            </span>
            {!collapsed && 'New chat'}
          </button>
        </div>

        {/* Navigation */}
        <nav className={`flex flex-col gap-0.5 pt-2 flex-shrink-0 ${collapsed ? 'px-0' : 'px-3'}`}>
          {nav.map(item => <NavItem key={item.to + item.label} {...item} collapsed={collapsed} onClick={onClose} />)}
        </nav>

        {/* Recent conversations */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin mt-4 px-3 pb-3">
          {!collapsed && (
            isLoggedIn ? (
              <>
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Recents</p>
                <ConversationList owner={user?.id} onNavigate={onClose} />
              </>
            ) : (
              <div className="mx-1 rounded-xl border border-black/[0.06] bg-white p-3">
                <p className="text-[13px] font-medium text-gray-800">Save your conversations</p>
                <p className="text-[12px] text-gray-500 mt-0.5">Sign in to keep your chat history across devices.</p>
                <div className="flex gap-2 mt-3">
                  <Link to="/login" onClick={onClose}
                        className="flex-1 text-center py-1.5 rounded-lg text-[12px] font-semibold text-white" style={{ background: GREEN }}>
                    Sign in
                  </Link>
                  <Link to="/register" onClick={onClose}
                        className="flex-1 text-center py-1.5 rounded-lg text-[12px] font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50">
                    Register
                  </Link>
                </div>
                <p className="text-[11px] text-gray-400 mt-3">
                  <Link to="/staff/login" onClick={onClose} className="hover:text-gray-600">Staff portal</Link>
                  {' · '}
                  <Link to="/admin/login" onClick={onClose} className="hover:text-gray-600">Admin</Link>
                </p>
              </div>
            )
          )}
        </div>

        {/* Account */}
        <div className={`flex-shrink-0 border-t border-black/[0.06] p-2 ${collapsed ? 'flex justify-center' : ''}`}>
          {isLoggedIn && user ? (
            <div ref={menuRef} className="relative">
              {menuOpen && (
                <div className={`absolute bottom-full mb-2 z-50 w-60 rounded-xl border border-gray-200 bg-white shadow-lg p-1.5 animate-fadeIn
                                 ${collapsed ? 'left-0' : 'left-0 right-0 w-auto'}`} role="menu">
                  <div className="px-2.5 py-2">
                    <p className="text-[13px] font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{user.identifier}</p>
                  </div>
                  <div className="h-px bg-gray-100 my-1" />
                  <button onClick={signOut} role="menuitem"
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-gray-700 hover:bg-gray-50">
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
              <button onClick={() => setMenuOpen(v => !v)} aria-haspopup="menu" aria-expanded={menuOpen}
                      title={collapsed ? user.name : undefined}
                      className={`flex items-center gap-2.5 rounded-lg hover:bg-black/[0.04] transition-colors
                        ${collapsed ? 'p-1' : 'w-full px-2 py-1.5'}`}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white flex-shrink-0"
                      style={{ background: GREEN }}>
                  {initials(user.name)}
                </span>
                {!collapsed && (
                  <>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="block text-[13px] font-medium text-gray-900 truncate">{user.name}</span>
                      <span className="block text-[11px] text-gray-500 capitalize">{user.role}</span>
                    </span>
                    <ChevronsUpDown size={14} className="text-gray-400 flex-shrink-0" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <Link to="/login" onClick={onClose} title={collapsed ? 'Sign in' : undefined}
                  className={`flex items-center gap-2.5 rounded-lg text-[13px] text-gray-700 hover:bg-black/[0.04]
                    ${collapsed ? 'p-2' : 'px-3 py-2'}`}>
              <LogIn size={16} /> {!collapsed && 'Sign in'}
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}
