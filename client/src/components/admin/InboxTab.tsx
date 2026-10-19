import { useEffect, useState } from 'react'
import { Loader2, ThumbsDown, HelpCircle, Plus, Check, X, ChevronDown, Inbox } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import toast from 'react-hot-toast'
import { errorMessage, getInbox, resolveInboxItem } from '../../services/api'
import type { InboxItem } from '../../types'

const GREEN = '#1A6B1A'

/**
 * Questions the bot had no verified answer for, or whose answer users rated
 * unhelpful. Staff turn each one into a knowledge base entry, or dismiss it.
 */
export default function InboxTab({ onKBAdded }: { onKBAdded?: () => void }) {
  const [items,    setItems]    = useState<InboxItem[] | null>(null)
  const [openKey,  setOpenKey]  = useState<string | null>(null)   // item with the answer form open
  const [showKey,  setShowKey]  = useState<string | null>(null)   // item with the bot's answer shown
  const [form,     setForm]     = useState({ question: '', answer: '', category: 'General' })
  const [busy,     setBusy]     = useState(false)

  useEffect(() => {
    getInbox().then(setItems).catch(() => { setItems([]); toast.error('Could not load the inbox') })
  }, [])

  function openForm(item: InboxItem) {
    setOpenKey(item.key)
    setForm({ question: item.question, answer: '', category: 'General' })
  }

  async function resolve(item: InboxItem, withAnswer: boolean) {
    if (withAnswer && (!form.question.trim() || !form.answer.trim())) return toast.error('Question and answer are required')
    setBusy(true)
    try {
      await resolveInboxItem(item.key, withAnswer ? form : undefined)
      setItems(list => list?.filter(i => i.key !== item.key) ?? null)
      setOpenKey(null)
      if (withAnswer) {
        toast.success('Added to the knowledge base — IbbulAI will use it from now on')
        onKBAdded?.()
      } else {
        toast.success('Dismissed')
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the inbox'))
    } finally {
      setBusy(false)
    }
  }

  if (!items) return <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin" style={{ color: GREEN }} /></div>

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-display font-semibold text-[14px] text-gray-800">Needs an answer ({items.length})</h3>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Questions IbbulAI couldn't answer from verified information, or answers users marked unhelpful. Add the correct answer to the knowledge base so the bot gets it right next time.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-12 flex flex-col items-center text-center gap-2">
          <Inbox size={28} className="text-gray-300" />
          <p className="text-sm text-gray-500">All caught up — nothing needs an answer right now.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map(item => (
            <li key={item.key} className="px-4 py-3">
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{item.question}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600">
                      Asked {item.count}×
                    </span>
                    {item.unanswered_count > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fff4dc', color: '#8a5a00' }}>
                        <HelpCircle size={11} /> No verified answer
                      </span>
                    )}
                    {item.thumbs_down > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: '#fdecec', color: '#b91c1c' }}>
                        <ThumbsDown size={11} /> Not helpful ×{item.thumbs_down}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">
                      last asked {formatDistanceToNowStrict(new Date(item.last_asked), { addSuffix: true })}
                    </span>
                  </div>
                  <button onClick={() => setShowKey(k => (k === item.key ? null : item.key))}
                          className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-gray-500 hover:text-gray-700">
                    <ChevronDown size={12} className={showKey === item.key ? 'rotate-180' : ''} />
                    {showKey === item.key ? 'Hide' : 'Show'} IbbulAI's answer
                  </button>
                  {showKey === item.key && (
                    <p className="mt-1.5 text-[12px] text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-2.5 max-h-48 overflow-y-auto scrollbar-thin">
                      {item.last_answer}
                    </p>
                  )}
                </div>
                {openKey !== item.key && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => openForm(item)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: GREEN }}>
                      <Plus size={13} /> Add answer
                    </button>
                    <button onClick={() => resolve(item, false)} disabled={busy} title="Dismiss without adding an answer"
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {openKey === item.key && (
                <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor={`q-${item.key}`}>Question</label>
                    <input id={`q-${item.key}`} value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
                           className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6B1A] bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor={`a-${item.key}`}>Verified answer</label>
                    <textarea id={`a-${item.key}`} value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
                              rows={4} placeholder="The correct, official answer…" autoFocus
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none resize-y focus:border-[#1A6B1A] bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1" htmlFor={`c-${item.key}`}>Category</label>
                    <input id={`c-${item.key}`} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                           placeholder="e.g. Admission, Finance, Hostel"
                           className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[#1A6B1A] bg-white" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => resolve(item, true)} disabled={busy}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: GREEN }}>
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save to knowledge base
                    </button>
                    <button onClick={() => setOpenKey(null)}
                            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold flex items-center gap-1">
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
