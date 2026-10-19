// Lets the chat page tell the sidebar's history list that a conversation was saved or changed
const listeners = new Set<() => void>()

export function onConversationsChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function conversationsChanged() {
  listeners.forEach(l => l())
}
