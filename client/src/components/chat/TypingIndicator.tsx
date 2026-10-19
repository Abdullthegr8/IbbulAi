export default function TypingIndicator() {
  return (
    <div className="flex gap-3 flex-row animate-msgSlideIn" role="status" aria-label="IbbulAI is thinking">
      <img src="/logo.png" alt="" className="hidden sm:block w-7 h-7 rounded-full object-cover flex-shrink-0" />
      <div className="flex items-center gap-2 px-1">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full animate-typingBounce"
                  style={{ background: '#1A6B1A', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <span className="text-[12px] text-gray-400">Thinking…</span>
      </div>
    </div>
  )
}
