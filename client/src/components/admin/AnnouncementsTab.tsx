import { useEffect, useState } from 'react'
import { Loader2, Plus, X, Trash2, Pin, PinOff, Megaphone } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  createAnnouncement, deleteAnnouncement, errorMessage, getAllAnnouncements, updateAnnouncement,
} from '../../services/api'
import type { Announcement } from '../../types'

const GREEN       = '#1A6B1A'
const GREEN_LIGHT = '#e8f5e8'
const EMPTY_FORM  = { title: '', body: '', category: 'General', pinned: false, expires: '' }

function isExpired(a: Announcement) {
  return !!a.expires_at && new Date(a.expires_at) <= new Date()
}

/** Staff post time-sensitive notices; IbbulAI treats them as its newest information. */
export default function AnnouncementsTab() {
  const [items,    setItems]    = useState<Announcement[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    getAllAnnouncements().then(setItems).catch(() => { setItems([]); toast.error('Could not load announcements') })
  }, [])

  async function save() {
    if (!form.title.trim() || !form.body.trim()) return toast.error('Title and text are required')
    setSaving(true)
    try {
      const created = await createAnnouncement({
        title:      form.title,
        body:       form.body,
        category:   form.category,
        pinned:     form.pinned,
        // End of the chosen day, local time
        expires_at: form.expires ? new Date(`${form.expires}T23:59:59`).toISOString() : null,
      })
      setItems(list => [created, ...(list ?? [])])
      setForm(EMPTY_FORM)
      setShowForm(false)
      toast.success('Announcement posted')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not post the announcement'))
    } finally {
      setSaving(false)
    }
  }

  async function togglePin(a: Announcement) {
    try {
      const updated = await updateAnnouncement(a.id, { pinned: !a.pinned })
      setItems(list => list?.map(x => (x.id === a.id ? updated : x)) ?? null)
    } catch {
      toast.error('Could not update the announcement')
    }
  }

  async function remove(a: Announcement) {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return
    try {
      await deleteAnnouncement(a.id)
      setItems(list => list?.filter(x => x.id !== a.id) ?? null)
      toast.success('Announcement deleted')
    } catch {
      toast.error('Could not delete the announcement')
    }
  }

  if (!items) return <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin" style={{ color: GREEN }} /></div>

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-[14px] text-gray-800">Announcements</h3>
          <p className="text-[12px] text-gray-400 mt-0.5">
            Shown on the Home page. Pinned ones also appear above the chat. IbbulAI uses them to answer questions, ahead of older information.
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: GREEN }}>
          <Plus size={13} /> New
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="ann-title">Title</label>
            <input id="ann-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={200}
                   placeholder="e.g. Fee payment deadline extended"
                   className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6B1A] bg-white" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="ann-body">Announcement</label>
            <textarea id="ann-body" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} maxLength={5000}
                      placeholder="Include exact dates, amounts and who it applies to."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none resize-y focus:border-[#1A6B1A] bg-white" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="ann-cat">Category</label>
              <input id="ann-cat" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                     placeholder="e.g. Finance, Exams, Hostel"
                     className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6B1A] bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor="ann-exp">Expires on (optional)</label>
              <input id="ann-exp" type="date" value={form.expires} onChange={e => setForm(f => ({ ...f, expires: e.target.value }))}
                     className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6B1A] bg-white" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 w-fit cursor-pointer">
            <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                   className="accent-[#1A6B1A]" />
            Pin — show above the chat for everyone
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: GREEN }}>
              {saving && <Loader2 size={14} className="animate-spin" />} Post announcement
            </button>
            <button onClick={() => setShowForm(false)}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold flex items-center gap-1">
              <X size={13} /> Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="px-4 py-12 flex flex-col items-center text-center gap-2">
          <Megaphone size={28} className="text-gray-300" />
          <p className="text-sm text-gray-500">No announcements yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map(a => {
            const expired = isExpired(a)
            return (
              <li key={a.id} className={`px-4 py-3 flex items-start gap-3 ${expired ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-800">{a.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: GREEN_LIGHT, color: GREEN }}>{a.category}</span>
                    {a.pinned && !expired && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800">Pinned</span>}
                    {expired && <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">Expired</span>}
                  </div>
                  <p className="text-[13px] text-gray-600 mt-1 whitespace-pre-line">{a.body}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Posted {format(new Date(a.created_at), 'MMM d, yyyy')}{a.created_by ? ` by ${a.created_by}` : ''}
                    {a.expires_at && ` · ${expired ? 'expired' : 'expires'} ${format(new Date(a.expires_at), 'MMM d, yyyy')}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => togglePin(a)} title={a.pinned ? 'Unpin' : 'Pin'} aria-label={a.pinned ? `Unpin ${a.title}` : `Pin ${a.title}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    {a.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button onClick={() => remove(a)} title="Delete" aria-label={`Delete ${a.title}`}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
