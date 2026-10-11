/**
 * Web search fallback (Tavily), used when the knowledge base has no answer.
 * Only runs when enabled in admin settings AND TAVILY_API_KEY is set.
 */

import { getConfig } from './configService.js';

export function webSearchAvailable() {
  const key = process.env.TAVILY_API_KEY;
  return getConfig('web_search_enabled') === 'true' && !!key && !key.startsWith('your_');
}

export async function webSearch(query) {
  const res = await fetch('https://api.tavily.com/search', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      api_key:     process.env.TAVILY_API_KEY,
      query:       `Ibrahim Badamasi Babangida University Lapai ${query}`,
      max_results: 3,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Tavily returned ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(r => ({
    title:   String(r.title || ''),
    url:     String(r.url || ''),
    content: String(r.content || '').slice(0, 1000),
  }));
}
