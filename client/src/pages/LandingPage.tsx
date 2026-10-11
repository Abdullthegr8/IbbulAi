import { Link, Navigate } from 'react-router-dom'
import { MessageCircle, Files, Clock, ShieldCheck, GraduationCap, Briefcase, ArrowRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const features = [
  { icon: MessageCircle, title: 'Ask in plain English',   text: 'Get clear, formatted answers about admissions, fees, registration, exams and campus life.' },
  { icon: Files,         title: 'Official documents',     text: 'Find and download forms, handbooks and notices uploaded by university staff.' },
  { icon: Clock,         title: 'Available 24/7',         text: 'No queues or office hours — IbbulAI answers whenever you need it.' },
  { icon: ShieldCheck,   title: 'IBBU-specific answers',  text: 'Searches a curated university knowledge base before answering.' },
]

const steps = [
  ['Ask a question', 'Type anything about IBBU — no account needed.'],
  ['IbbulAI searches', 'It checks the university knowledge base and documents first.'],
  ['Get your answer', 'A clear answer with suggested follow-up questions.'],
]

export default function LandingPage() {
  const { isLoggedIn } = useAuth()
  if (isLoggedIn) return <Navigate to="/home" replace />

  return (
    <div className="min-h-full bg-white">
      {/* Nav */}
      <header className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="IBBU Logo" className="w-9 h-9 rounded-full object-cover" />
          <span className="font-display font-bold text-lg" style={{ color: '#1A6B1A' }}>IbbulAI</span>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link to="/login" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-[#1A6B1A]">Sign in</Link>
          <Link to="/chat" className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: '#1A6B1A' }}>
            Try it now
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-16 sm:pt-16 text-center">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: '#1A6B1A' }} />
          <img src="/logo.png" alt="" className="relative w-24 h-24 rounded-full object-cover border-4 shadow-lg"
               style={{ borderColor: '#e8f5e8' }} />
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: '#e8f5e8', color: '#1A6B1A' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#1A6B1A' }} /> Online · Ibrahim Badamasi Babangida University
        </span>
        <h1 className="font-display font-bold text-4xl sm:text-5xl text-gray-900 leading-tight max-w-3xl mx-auto">
          Your intelligent guide to <span style={{ color: '#1A6B1A' }}>IBBU, Lapai</span>
        </h1>
        <p className="text-gray-500 text-base sm:text-lg mt-4 max-w-2xl mx-auto">
          IbbulAI answers your questions about the university and helps you find official documents — instantly, any time of day.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link to="/chat" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold shadow"
                style={{ background: '#1A6B1A' }}>
            Start chatting <ArrowRight size={17} />
          </Link>
          <Link to="/register" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border font-semibold"
                style={{ borderColor: '#c8e6c8', color: '#1A6B1A' }}>
            <GraduationCap size={17} /> Student sign up
          </Link>
          <Link to="/staff/register" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">
            <Briefcase size={17} /> Staff sign up
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-[#f5f5f5] py-14">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="font-display font-bold text-2xl text-gray-900 text-center mb-8">What IbbulAI does</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: '#e8f5e8' }}>
                  <Icon size={19} style={{ color: '#1A6B1A' }} />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
                <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="font-display font-bold text-2xl text-gray-900 text-center mb-8">How it works</h2>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map(([title, text], i) => (
            <li key={title} className="rounded-2xl border border-gray-200 p-5">
              <span className="w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center mb-3"
                    style={{ background: '#1A6B1A' }}>{i + 1}</span>
              <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
              <p className="text-[13px] text-gray-500 mt-1">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="px-4 pb-14">
        <div className="max-w-4xl mx-auto rounded-3xl p-8 sm:p-10 text-center text-white" style={{ background: '#1A6B1A' }}>
          <h2 className="font-display font-bold text-2xl sm:text-3xl">Have a question about IBBU?</h2>
          <p className="text-white/75 mt-2">Ask IbbulAI now — no account required.</p>
          <Link to="/chat" className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-white font-semibold"
                style={{ color: '#1A6B1A' }}>
            Start chatting <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} IbbulAI · Ibrahim Badamasi Babangida University, Lapai ·{' '}
        <Link to="/admin/login" className="hover:text-gray-600">Admin</Link>
      </footer>
    </div>
  )
}
