import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle, Files, GraduationCap, Wallet, ClipboardList, BedDouble, CalendarDays, ScrollText, ArrowRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const topics = [
  { icon: GraduationCap, label: 'Admission requirements', q: 'What are the admission requirements for IBBU?' },
  { icon: Wallet,        label: 'School fees',            q: 'How do I pay my school fees?' },
  { icon: ClipboardList, label: 'Course registration',    q: 'How do I register my courses?' },
  { icon: BedDouble,     label: 'Hostel accommodation',   q: 'How do I apply for hostel accommodation?' },
  { icon: CalendarDays,  label: 'Academic calendar',      q: 'Where can I find the academic calendar?' },
  { icon: ScrollText,    label: 'Transcripts',            q: 'How do I request my transcript?' },
]

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-[#f5f5f5] animate-fadeIn">
      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-5">
        <section className="rounded-2xl p-6 sm:p-8 text-white shadow-sm" style={{ background: '#1A6B1A' }}>
          <p className="text-white/70 text-sm">{user ? `Welcome back, ${user.role === 'admin' ? 'Admin' : user.name.split(' ')[0]}` : 'Welcome to IbbulAI'}</p>
          <h1 className="font-display font-bold text-2xl sm:text-3xl mt-1">How can IbbulAI help you today?</h1>
          <p className="text-white/75 text-sm mt-2 max-w-xl">
            Get instant answers about Ibrahim Badamasi Babangida University and find official documents — any time.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/chat" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-sm font-semibold"
                  style={{ color: '#1A6B1A' }}>
              <MessageCircle size={16} /> Start chatting
            </Link>
            <Link to="/documents" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-semibold transition-colors">
              <Files size={16} /> Browse documents
            </Link>
          </div>
        </section>

        <section>
          <h2 className="font-display font-semibold text-[15px] text-gray-800 mb-3">Popular topics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topics.map(({ icon: Icon, label, q }) => (
              <button key={label} onClick={() => navigate('/chat', { state: { q } })}
                      className="group text-left bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow transition-shadow flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#e8f5e8' }}>
                  <Icon size={17} style={{ color: '#1A6B1A' }} />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
                <ArrowRight size={15} className="text-gray-300 group-hover:text-[#1A6B1A] transition-colors" />
              </button>
            ))}
          </div>
        </section>

        {!user && (
          <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 text-sm">Save your conversations</h3>
              <p className="text-[13px] text-gray-500 mt-0.5">Students sign up with their matric number — it takes less than a minute.</p>
            </div>
            <Link to="/register" className="px-4 py-2 rounded-xl text-white text-sm font-semibold text-center" style={{ background: '#1A6B1A' }}>
              Create account
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}
