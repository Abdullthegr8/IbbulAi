import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { GraduationCap, Briefcase, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout, { Field, inputClass, buttonClass } from './AuthLayout'
import { userLogin, userRegister, errorMessage } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'

// Same format the server enforces, e.g. U22/FNS/MCB/1000
const MATRIC_RE = /^U\d{2}\/[A-Z]{2,5}\/[A-Z]{2,5}\/\d{3,5}$/i

interface Props {
  role: 'student' | 'staff'
  mode: 'login' | 'register'
}

export default function UserAuthForm({ role, mode }: Props) {
  const { login, isLoggedIn, user } = useAuth()
  const navigate = useNavigate()
  const [name,       setName]       = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [error,      setError]      = useState('')
  const [busy,       setBusy]       = useState(false)

  const isStudent  = role === 'student'
  const isRegister = mode === 'register'
  const home       = isStudent ? '/chat' : '/admin'

  if (isLoggedIn) return <Navigate to={user?.role === 'student' ? '/chat' : '/admin'} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (isStudent && !MATRIC_RE.test(identifier.trim())) {
      return setError('Enter a valid matric number, e.g. U22/FNS/MCB/1000')
    }
    if (isRegister) {
      if (name.trim().length < 2) return setError('Please enter your full name')
      if (password.length < 8)    return setError('Password must be at least 8 characters')
      if (password !== confirm)   return setError('Passwords do not match')
    }
    setBusy(true)
    try {
      const res = isRegister
        ? await userRegister({ role, name: name.trim(), identifier: identifier.trim(), password })
        : await userLogin(role, identifier.trim(), password)
      login(res.token, res.user)
      toast.success(isRegister ? `Welcome to IbbulAI, ${res.user.name.split(' ')[0]}!` : 'Signed in')
      navigate(home, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const otherMode = isStudent
    ? (isRegister ? { to: '/login', q: 'Already have an account?', a: 'Sign in' } : { to: '/register', q: 'New to IbbulAI?', a: 'Create a student account' })
    : (isRegister ? { to: '/staff/login', q: 'Already registered?', a: 'Sign in' } : { to: '/staff/register', q: 'New staff member?', a: 'Register' })

  return (
    <AuthLayout
      icon={isStudent ? GraduationCap : Briefcase}
      panelTitle={isStudent ? 'Student Portal' : 'Staff Portal'}
      panelText={isStudent
        ? 'Sign in with your matric number to save your chat history and get personalised answers about IBBU.'
        : 'Staff can upload official documents and manage the IbbulAI knowledge base.'}
      title={isRegister ? (isStudent ? 'Create your student account' : 'Register as staff') : (isStudent ? 'Student sign in' : 'Staff sign in')}
      subtitle={isStudent ? 'Use your IBBU matric number' : 'Use your IBBU work email address'}
      footer={<>
        {otherMode.q}{' '}
        <Link to={otherMode.to} className="font-semibold" style={{ color: '#1A6B1A' }}>{otherMode.a}</Link>
        <div className="mt-2">
          <Link to={isStudent ? (isRegister ? '/staff/register' : '/staff/login') : (isRegister ? '/register' : '/login')}
                className="text-xs text-gray-400 hover:text-gray-600">
            {isStudent ? 'Are you a staff member?' : 'Are you a student?'}
          </Link>
          {!isStudent && !isRegister && (
            <>
              <span className="text-xs text-gray-300 mx-2">·</span>
              <Link to="/admin/login" className="text-xs text-gray-400 hover:text-gray-600">Administrator?</Link>
            </>
          )}
        </div>
      </>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {isRegister && (
          <Field label="Full name">
            <input className={inputClass} value={name} onChange={e => setName(e.target.value)}
                   autoComplete="name" placeholder="e.g. Aisha Mohammed" required />
          </Field>
        )}
        <Field label={isStudent ? 'Matric number' : 'Work email'}
               hint={isRegister ? (isStudent ? 'Format: U22/FNS/MCB/1000' : 'Must be an @ibbu.edu.ng address') : undefined}>
          <input className={inputClass} value={identifier} onChange={e => setIdentifier(e.target.value)}
                 type={isStudent ? 'text' : 'email'} autoComplete="username" required
                 placeholder={isStudent ? 'U22/FNS/MCB/1000' : 'name@ibbu.edu.ng'} />
        </Field>
        <Field label="Password" hint={isRegister ? 'At least 8 characters' : undefined}>
          <input className={inputClass} value={password} onChange={e => setPassword(e.target.value)}
                 type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required />
        </Field>
        {isRegister && (
          <Field label="Confirm password">
            <input className={inputClass} value={confirm} onChange={e => setConfirm(e.target.value)}
                   type="password" autoComplete="new-password" required />
          </Field>
        )}
        {error && <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy && <Loader2 size={15} className="animate-spin" />}
          {isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  )
}
