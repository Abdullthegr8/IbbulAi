import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, FileImage, Download, Eye, Loader2, MessageSquareText } from 'lucide-react'
import { format } from 'date-fns'
import { getDocuments, getDownloadUrl, errorMessage } from '../services/api'
import type { Document } from '../services/api'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Types a browser can display inline
const PREVIEWABLE = new Set(['application/pdf', 'text/plain', 'image/png', 'image/jpeg'])

export default function DocumentsPage() {
  const navigate = useNavigate()
  const [docs,     setDocs]     = useState<Document[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('All')

  // Debounced server-side search (matches names, descriptions and document text)
  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getDocuments(search.trim() ? { search: search.trim() } : undefined)
        .then(d => { setDocs(d); setError('') })
        .catch(err => setError(errorMessage(err, 'Could not load documents')))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  const categories = useMemo(() => ['All', ...Array.from(new Set(docs.map(d => d.category))).sort()], [docs])
  const visible = category === 'All' ? docs : docs.filter(d => d.category === category)

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-[#f5f5f5] animate-fadeIn">
      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-4">
        <div>
          <h1 className="font-display font-bold text-xl text-gray-800">University documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Official forms, handbooks and notices uploaded by IBBU staff.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
                   aria-label="Search documents"
                   className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white focus:border-[#1A6B1A]" />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category"
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none bg-white text-gray-700 focus:border-[#1A6B1A]">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin" style={{ color: '#1A6B1A' }} /></div>
          ) : error ? (
            <p className="px-4 py-10 text-center text-sm text-red-500">{error}</p>
          ) : visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              {search ? 'No documents match your search.' : 'No documents have been uploaded yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {visible.map(d => {
                const Icon = d.mimetype.startsWith('image/') ? FileImage : FileText
                const url  = getDownloadUrl(d)
                return (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#e8f5e8' }}>
                      <Icon size={16} style={{ color: '#1A6B1A' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {d.category} · {formatSize(d.size)} · {format(new Date(d.created_at), 'MMM d, yyyy')}
                        {d.description && ` · ${d.description}`}
                      </p>
                    </div>
                    {PREVIEWABLE.has(d.mimetype) && d.cloudinary_url && (
                      <a href={d.cloudinary_url} target="_blank" rel="noopener noreferrer" title="Preview"
                         className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                        <Eye size={15} />
                      </a>
                    )}
                    {d.searchable && (
                      <button onClick={() => navigate('/chat', { state: { doc: { id: d.id, name: d.name } } })}
                              title="Ask IbbulAI about this document" aria-label={`Ask about ${d.name}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                              style={{ background: '#1A6B1A' }}>
                        <MessageSquareText size={13} /> <span className="hidden sm:inline">Ask</span>
                      </button>
                    )}
                    <a href={url} download title="Download" aria-label={`Download ${d.name}`}
                       className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors hover:bg-[#e8f5e8]"
                       style={{ borderColor: '#c8e6c8', color: '#1A6B1A' }}>
                      <Download size={13} /> <span className="hidden sm:inline">Download</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
