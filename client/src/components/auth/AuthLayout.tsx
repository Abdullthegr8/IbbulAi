import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon:      LucideIcon
  panelTitle: string
  panelText:  string
  title:     string
  subtitle:  string
  children:  ReactNode
  footer?:   ReactNode
}

/** Two-panel auth layout: green brand panel (desktop) + white form. */
export default function AuthLayout({ icon: Icon, panelTitle, panelText, title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-full flex bg-white">
      <aside className="hidden lg:flex w-[420px] flex-shrink-0 flex-col justify-between p-10 text-white"
             style={{ background: '#1A6B1A' }}>
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="IBBU Logo" className="w-12 h-12 rounded-full bg-white p-0.5 object-cover" />
          <div>
            <div className="font-display font-bold text-lg leading-tight">IbbulAI</div>
            <div className="text-white/60 text-xs">IBBU Intelligent Assistant</div>
          </div>
        </Link>
        <div>
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
            <Icon size={26} />
          </div>
          <h2 className="font-display font-bold text-3xl mb-3">{panelTitle}</h2>
          <p className="text-white/75 text-sm leading-relaxed">{panelText}</p>
        </div>
        <p className="text-white/40 text-xs">Ibrahim Badamasi Babangida University, Lapai</p>
      </aside>

      <main className="flex-1 flex items-center justify-center px-4 py-10 animate-fadeIn">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2.5 mb-8">
            <img src="/logo.png" alt="IBBU Logo" className="w-10 h-10 rounded-full object-cover" />
            <span className="font-display font-bold text-lg" style={{ color: '#1A6B1A' }}>IbbulAI</span>
          </Link>
          <h1 className="font-display font-bold text-2xl text-gray-900 mb-1">{title}</h1>
          <p className="text-sm text-gray-500 mb-7">{subtitle}</p>
          {children}
          {footer && <div className="mt-6 text-sm text-gray-500 text-center">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

export const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#1A6B1A] focus:ring-2 focus:ring-[#1A6B1A]/15 bg-white'

export const buttonClass =
  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm disabled:opacity-60 transition-colors bg-[#1A6B1A] hover:bg-[#155715]'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}
