import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, SquarePen } from 'lucide-react'
import Sidebar from './Sidebar'

const COLLAPSED_KEY = 'unibot_sidebar_collapsed'

const pageTitles: Record<string, string> = {
  '/home':      'Home',
  '/documents': 'Documents',
  '/about':     'About',
  '/admin':     'Dashboard',
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed,  setCollapsed]  = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1' } catch { return false }
  })
  const isChat = location.pathname === '/chat' || location.pathname.startsWith('/chat/')
  const title  = pageTitles[location.pathname] ?? 'IbbulAI'

  // Close the drawer when the route changes (e.g. browser back)
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  function toggleCollapsed() {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1') } catch { /* ignore */ }
      return !c
    })
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen}
               onToggle={toggleCollapsed} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar; desktop pages other than chat get a slim title bar */}
        <header className={`h-12 flex items-center gap-1 px-2 flex-shrink-0 border-b border-black/[0.06] bg-white
                            ${isChat ? 'lg:hidden' : ''}`}>
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu"
                  className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <span className="flex-1 min-w-0 truncate font-display font-semibold text-[15px] text-gray-800 px-1 lg:px-3">{title}</span>
          <button onClick={() => navigate('/chat', { state: { fresh: Date.now() } })} aria-label="New chat" title="New chat"
                  className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100">
            <SquarePen size={19} />
          </button>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
