import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import AuthLayout, { Field, inputClass, buttonClass } from '../components/auth/AuthLayout'
import { login as adminLogin, errorMessage } from '../services/api'
import { useAuth } from '../hooks/useAuth'

export default function AdminLoginPage() {
  const { login, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  if (isAdmin) return <Navigate to="/admin" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await adminLogin(username.trim(), password)
      login(res.token, res.user)
      toast.success('Signed in as administrator')
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout icon={ShieldCheck} panelTitle="Administration"
      panelText="Manage IbbulAI's documents, knowledge base, settings and usage analytics."
      title="Admin sign in" subtitle="Administrator access only">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Username">
          <input className={inputClass} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
        </Field>
        <Field label="Password">
          <input className={inputClass} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {error && <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy && <Loader2 size={15} className="animate-spin" />} Sign in
        </button>
      </form>
    </AuthLayout>
  )
}
