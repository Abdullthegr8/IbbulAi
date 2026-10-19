import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, MessageSquare, Users, BarChart2, Upload, Trash2, Plus, X, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  getStats, getChatLogs, getTopQuestions, getKnowledgeBase,
  addKBEntry, deleteKBEntry, uploadDocument, deleteDocument,
  getDocuments, getSettings, saveSettings,
} from '../services/api'
import type { AdminStats, ChatLog, TopQuestion, KBEntry } from '../types'
import type { Document, SystemSettings } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import AnalyticsTab from '../components/admin/AnalyticsTab'
import InboxTab from '../components/admin/InboxTab'
import AnnouncementsTab from '../components/admin/AnnouncementsTab'

type AdminTab = 'overview' | 'analytics' | 'inbox' | 'logs' | 'documents' | 'knowledge' | 'announcements' | 'settings'
type StaffTab = 'inbox' | 'documents' | 'knowledge' | 'announcements'

const GREEN       = '#1A6B1A'
const GREEN_LIGHT = '#e8f5e8'
const GREEN_MID   = '#c8e6c8'

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: GREEN_LIGHT }}>
          <Icon size={15} style={{ color: GREEN }} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      </div>
      <div className="font-display font-bold text-2xl text-gray-800">{Number(value).toLocaleString()}</div>
    </div>
  )
}

export default function AdminPage() {
  const { isAdmin, user, isLoggedIn } = useAuth()
  const isStaff   = user?.role === 'staff'
  const navigate  = useNavigate()

  const [tab,        setTab]        = useState<AdminTab | StaffTab>(isStaff ? 'inbox' : 'overview')
  const [stats,      setStats]      = useState<AdminStats | null>(null)
  const [logs,       setLogs]       = useState<ChatLog[]>([])
  const [topQ,       setTopQ]       = useState<TopQuestion[]>([])
  const [kb,         setKb]         = useState<KBEntry[]>([])
  const [docs,       setDocs]       = useState<Document[]>([])
  const [loading,    setLoading]    = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [showKBForm, setShowKBForm] = useState(false)
  const [newKB,      setNewKB]      = useState({ question: '', answer: '', category: 'General' })

  // Settings state
  const [settings,      setSettings]      = useState<SystemSettings | null>(null)
  const [settingsForm,  setSettingsForm]  = useState<Partial<SystemSettings>>({})
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) { navigate('/admin/login', { replace: true }); return }
    if (!isAdmin && !isStaff) { navigate('/chat'); return }
    loadData()
  }, [isLoggedIn, isAdmin, isStaff]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    try {
      const promises: Promise<any>[] = [getKnowledgeBase(), getDocuments()]
      if (isAdmin) promises.push(getStats(), getChatLogs(), getTopQuestions(), getSettings())
      const results = await Promise.all(promises)
      setKb(results[0])
      setDocs(results[1])
      if (isAdmin) {
        setStats(results[2])
        setLogs(results[3])
        setTopQ(results[4])
        setSettings(results[5])
        setSettingsForm(results[5])
      }
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    try {
      await saveSettings(settingsForm)
      toast.success('Settings saved and applied immediately!')
      // Reload settings from server to confirm
      const fresh = await getSettings()
      setSettings(fresh)
      setSettingsForm(fresh)
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    form.append('category', 'Academic')
    setUploading(true)
    try {
      await uploadDocument(form)
      toast.success('Document uploaded successfully!')
      await getDocuments().then(setDocs)
    } catch { toast.error('Upload failed. Please try again.') }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDeleteDoc(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    try {
      await deleteDocument(id)
      setDocs(d => d.filter(x => x.id !== id))
      toast.success('Document deleted')
    } catch { toast.error('Delete failed') }
  }

  async function handleAddKB() {
    if (!newKB.question || !newKB.answer) return toast.error('Question and answer are required')
    try {
      await addKBEntry(newKB)
      await getKnowledgeBase().then(setKb)
      setNewKB({ question: '', answer: '', category: 'General' })
      setShowKBForm(false)
      toast.success('Knowledge base entry added')
    } catch { toast.error('Failed to add entry') }
  }

  async function handleDeleteKB(id: number) {
    try {
      await deleteKBEntry(id)
      setKb(k => k.filter(x => x.id !== id))
      toast.success('Entry deleted')
    } catch { toast.error('Failed to delete entry') }
  }

  const adminTabs: { key: AdminTab; label: string }[] = [
    { key: 'overview',      label: 'Overview' },
    { key: 'analytics',     label: 'Analytics' },
    { key: 'inbox',         label: 'Inbox' },
    { key: 'logs',          label: 'Chat Logs' },
    { key: 'documents',     label: 'Documents' },
    { key: 'knowledge',     label: 'Knowledge Base' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'settings',      label: 'Settings' },
  ]
  const staffTabs: { key: StaffTab; label: string }[] = [
    { key: 'inbox',         label: 'Inbox' },
    { key: 'documents',     label: 'Documents' },
    { key: 'knowledge',     label: 'Knowledge Base' },
    { key: 'announcements', label: 'Announcements' },
  ]
  const tabs = isAdmin ? adminTabs : staffTabs
  // Postgres COUNT(*) arrives as a string, hence Number()
  const maxTopCount = Math.max(1, ...topQ.map(q => Number(q.count)))

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#f5f5f5]">
      <Loader2 size={28} className="animate-spin" style={{ color: GREEN }} />
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-[#f5f5f5]">

      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-display font-bold text-lg text-gray-800">
            {isAdmin ? 'Admin Dashboard' : 'Staff Panel'}
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ background: GREEN_LIGHT, color: GREEN }}>
            {isAdmin ? 'Administrator' : 'Staff'}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {isAdmin ? 'Manage IbbulAI — documents, knowledge base, settings, and usage analytics' : 'Answer open questions and manage documents, knowledge base and announcements'}
        </p>
        <div className="flex gap-0 mt-4 overflow-x-auto scrollbar-thin -mb-px">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex-shrink-0 px-4 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                      ${tab === t.key ? 'border-[#1A6B1A] text-[#1A6B1A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5">

        {/* ── Overview ── */}
        {tab === 'overview' && isAdmin && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={FileText}      label="Documents"       value={stats?.totalDocuments ?? 0} />
              <StatCard icon={MessageSquare} label="Total Chats"     value={stats?.totalChats ?? 0} />
              <StatCard icon={Users}         label="Active Users"    value={stats?.totalUsers ?? 0} />
              <StatCard icon={BarChart2}     label="Questions Today" value={stats?.questionsToday ?? 0} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h3 className="font-display font-semibold text-[14px] text-gray-800 mb-4">Top Questions</h3>
                <div className="flex flex-col gap-3">
                  {topQ.slice(0, 6).map((q, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[12px] text-gray-600 min-w-[110px] truncate">{q.question}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.round((Number(q.count) / maxTopCount) * 100)}%`, background: GREEN }} />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-500 w-6 text-right">{q.count}</span>
                    </div>
                  ))}
                  {topQ.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No questions yet</p>}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <h3 className="font-display font-semibold text-[14px] text-gray-800 mb-4">Recent Chat Logs</h3>
                <div className="flex flex-col gap-1">
                  {logs.slice(0, 5).map(l => (
                    <div key={l.id} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0">
                      <span className="text-[11px] font-semibold min-w-[48px]" style={{ color: GREEN }}>
                        #{l.id}
                      </span>
                      <span className="flex-1 text-[12px] text-gray-700 truncate">{l.question}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {format(new Date(l.created_at), 'h:mm a')}
                      </span>
                    </div>
                  ))}
                  {logs.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No chat logs yet</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'analytics' && isAdmin && <AnalyticsTab />}

        {tab === 'inbox' && <InboxTab onKBAdded={() => getKnowledgeBase().then(setKb).catch(() => {})} />}

        {tab === 'announcements' && <AnnouncementsTab />}

        {/* ── Chat Logs ── */}
        {tab === 'logs' && isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-display font-semibold text-[14px] text-gray-800">All Chat Logs</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Question', 'Source', 'Provider', 'Time'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 max-w-[240px] text-gray-800">
                        <span className="block truncate">{l.question}</span>
                        {(l.unanswered || l.feedback) && (
                          <span className="flex gap-1 mt-0.5">
                            {l.unanswered && <span className="px-1.5 rounded text-[10px] font-semibold" style={{ background: '#fff4dc', color: '#8a5a00' }}>No verified answer</span>}
                            {l.feedback === 1  && <span className="px-1.5 rounded text-[10px] font-semibold" style={{ background: GREEN_LIGHT, color: GREEN }}>Helpful</span>}
                            {l.feedback === -1 && <span className="px-1.5 rounded text-[10px] font-semibold" style={{ background: '#fdecec', color: '#b91c1c' }}>Not helpful</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-500 max-w-[140px] truncate">{l.source || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: GREEN_LIGHT, color: GREEN }}>
                          {l.provider || 'Groq'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-gray-400">{format(new Date(l.created_at), 'MMM d, h:mm a')}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No chat logs yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Documents ── */}
        {tab === 'documents' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h3 className="font-display font-semibold text-[14px] text-gray-800 mb-3">Upload Document</h3>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors
                ${uploading ? 'opacity-50 pointer-events-none' : 'hover:bg-[#f0faf0]'}`}
                style={{ borderColor: uploading ? '#ccc' : GREEN_MID }}>
                {uploading ? <Loader2 size={28} className="animate-spin" style={{ color: GREEN }} /> : <Upload size={28} className="text-gray-400" />}
                <p className="text-sm text-gray-600 text-center px-4">
                  {uploading ? 'Uploading and indexing…' : <><span className="font-semibold" style={{ color: GREEN }}>Click to upload</span> or drag and drop</>}
                </p>
                <p className="text-[11px] text-gray-400">PDF, DOCX, images · Max 50MB</p>
                <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt,.png,.jpg" onChange={handleUpload} />
              </label>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-display font-semibold text-[14px] text-gray-800">Uploaded Documents ({docs.length})</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {docs.map(d => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: GREEN_LIGHT }}>
                      <FileText size={15} style={{ color: GREEN }} />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{d.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0" style={{ background: GREEN_LIGHT, color: GREEN }}>{d.category}</span>
                    <button onClick={() => handleDeleteDoc(d.id)} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {docs.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">No documents uploaded yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Knowledge Base ── */}
        {tab === 'knowledge' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-display font-semibold text-[14px] text-gray-800">Knowledge Base FAQs</h3>
              <button onClick={() => setShowKBForm(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: GREEN }}>
                <Plus size={13} /> Add Entry
              </button>
            </div>
            {showKBForm && (
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Question</label>
                    <input value={newKB.question} onChange={e => setNewKB(v => ({ ...v, question: e.target.value }))}
                           placeholder="e.g. What are the graduation requirements?"
                           className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6B1A] bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Answer</label>
                    <textarea value={newKB.answer} onChange={e => setNewKB(v => ({ ...v, answer: e.target.value }))}
                              rows={3} placeholder="Full answer text…"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none resize-none focus:border-[#1A6B1A] bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                    <input value={newKB.category} onChange={e => setNewKB(v => ({ ...v, category: e.target.value }))}
                           placeholder="e.g. Admission, Finance, Hostel"
                           className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6B1A] bg-white" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddKB} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: GREEN }}>Save Entry</button>
                    <button onClick={() => setShowKBForm(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold flex items-center gap-1">
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="divide-y divide-gray-100">
              {kb.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <span className="flex-1 text-sm text-gray-800 truncate">{entry.question}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0" style={{ background: GREEN_LIGHT, color: GREEN }}>Active</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 flex-shrink-0">{entry.category}</span>
                  <button onClick={() => handleDeleteKB(entry.id)} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {kb.length === 0 && <p className="px-4 py-8 text-center text-sm text-gray-400">No entries yet. Add one above.</p>}
            </div>
          </div>
        )}

        {/* ── Settings (admin only) — persists to PostgreSQL ── */}
        {tab === 'settings' && isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-display font-semibold text-[14px] text-gray-800">System Settings</h3>
              <p className="text-[12px] text-gray-400 mt-0.5">Changes are saved to the database and applied immediately — no server restart needed.</p>
            </div>
            <div className="divide-y divide-gray-100">

              {/* Web Search */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">Web Search Fallback</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">Search the web when knowledge base has no answer</p>
                </div>
                <select
                  value={settingsForm.web_search_enabled || 'false'}
                  onChange={e => setSettingsForm(s => ({ ...s, web_search_enabled: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none bg-gray-50 text-gray-700 w-full sm:w-auto focus:border-[#1A6B1A]">
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>

              {/* RAG Top-K */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">RAG Top-K Results</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">Knowledge chunks retrieved per query</p>
                </div>
                <select
                  value={settingsForm.rag_top_k || '5'}
                  onChange={e => setSettingsForm(s => ({ ...s, rag_top_k: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none bg-gray-50 text-gray-700 w-full sm:w-auto focus:border-[#1A6B1A]">
                  <option value="3">Top 3</option>
                  <option value="5">Top 5</option>
                  <option value="10">Top 10</option>
                </select>
              </div>

              {/* Max file size */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">Max Upload Size</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">Maximum document upload size</p>
                </div>
                <select
                  value={settingsForm.max_file_size_mb || '50'}
                  onChange={e => setSettingsForm(s => ({ ...s, max_file_size_mb: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none bg-gray-50 text-gray-700 w-full sm:w-auto focus:border-[#1A6B1A]">
                  <option value="25">25 MB</option>
                  <option value="50">50 MB</option>
                  <option value="100">100 MB</option>
                </select>
              </div>

            </div>

            {/* Save button */}
            <div className="px-4 py-4 border-t border-gray-100 flex items-center gap-3">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow disabled:opacity-50 transition-all"
                style={{ background: GREEN }}>
                {savingSettings
                  ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                  : <><Save size={15} /> Save Settings</>}
              </button>
              <p className="text-[11px] text-gray-400">Settings are saved to the database and take effect immediately.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
