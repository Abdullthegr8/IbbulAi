const techStack = [
  'React + TypeScript', 'TailwindCSS', 'Node.js + Express',
  'PostgreSQL', 'Groq LLM (Qwen3 32B)', 'RAG Pipeline',
  'Cloudinary', 'JWT Auth',
]

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-[#f5f5f5]">
      <div className="w-full py-8 px-4 text-center" style={{ background: '#1A6B1A' }}>
        <img src="/logo.png" alt="IBB University"
             className="w-20 h-20 rounded-full object-cover bg-white p-1 shadow-lg mx-auto mb-3" />
        <h1 className="font-display font-bold text-white text-xl">IbbulAI</h1>
        <p className="text-white/70 text-sm">Ibrahim Badamasi Babangida University, Lapai</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-7">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-gray-600">
            <p>
              <strong className="text-gray-800">IbbulAI</strong> is the official intelligent assistant for Ibrahim
              Badamasi Babangida University (IBBU), Lapai, Niger State. It helps students, lecturers, and staff
              access university information and official documents instantly — available 24/7.
            </p>
            <p>
              It uses <strong className="text-gray-800">Retrieval-Augmented Generation (RAG)</strong> to search
              a structured university knowledge base first. The LLM layer is provider-agnostic — currently powered
              by <strong className="text-gray-800">Groq (Qwen3 32B)</strong>, with plug-and-play support for
              OpenAI and Anthropic Claude.
            </p>
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Project Information</p>
            <div className="flex flex-col divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
              {[
                ['App Name',    'IbbulAI'],
                ['University',  'Ibrahim Badamasi Babangida University, Lapai, Niger State'],
                ['Project',     'Design and Implementation of an Intelligent Chatbot System Powered by a Large Language Model for University Information and Document Retrieval'],
                ['Stack',       'Node.js · React · PostgreSQL · Groq (Qwen3 32B)'],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-4 py-3 bg-gray-50 even:bg-white">
                  <span className="text-[11px] font-semibold text-gray-400 sm:min-w-[100px] uppercase tracking-wide">{k}</span>
                  <span className="text-sm text-gray-700">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Technology Stack</p>
            <div className="flex flex-wrap gap-2">
              {techStack.map(t => (
                <span key={t} className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background: '#e8f5e8', color: '#1A6B1A' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5 pb-4">
          © {new Date().getFullYear()} IbbulAI · Ibrahim Badamasi Babangida University, Lapai. All rights reserved.
        </p>
      </div>
    </div>
  )
}
