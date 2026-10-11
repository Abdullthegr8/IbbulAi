import { useState } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../../hooks/useAuth'

const pageTitles: Record<string, string> = {
  '/home':        'Home',
  '/chat':        'Chat',
  '/documents':   'Documents',
  '/about':       'About',
  '/admin':       'Admin Dashboard',
  '/admin/login': 'Admin Login',
}

export default function Layout() {
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const title = pageTitles[location.pathname] || 'IbbulAI'

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f5]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-14 flex items-center px-4 gap-3 border-b border-gray-200 bg-white flex-shrink-0 shadow-sm">
          <button onClick={() => setSidebarOpen(true)}
                  className="lg:hidden flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Open menu">
            <Menu size={20} className="text-gray-600" />
          </button>
          <img src="/logo.png" alt="IBBU" className="w-8 h-8 rounded-full object-cover lg:hidden flex-shrink-0" />
          <span className="flex-1 font-display font-semibold text-[15px] text-gray-800 truncate">{title}</span>

          {!isLoggedIn && (
            <div className="hidden sm:flex items-center gap-2">
              <Link to="/login" className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-[#1A6B1A] transition-colors">
                Sign in
              </Link>
              <Link to="/register" className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg"
                    style={{ background: '#1A6B1A' }}>
                Register
              </Link>
            </div>
          )}

          <span className="hidden sm:inline-flex text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0"
                style={{ background: '#e8f5e8', color: '#1A6B1A' }}>
            IbbulAI
          </span>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
