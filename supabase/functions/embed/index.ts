// IbbulAI embeddings — Supabase Edge Function
//
// Turns text into 384-number vectors with Supabase's built-in gte-small model,
// for semantic search over the knowledge base. Called only by the IbbulAI server,
// which proves itself with the EMBED_SECRET header.
//
// Deploy: Dashboard → Edge Functions → Deploy a new function → Via editor,
// name it "embed", paste this file, then turn OFF "Verify JWT" for it and add
// the secret EMBED_SECRET (Edge Functions → Secrets). See README.

const model = new Supabase.ai.Session('gte-small');
const MAX_INPUTS = 32;
const MAX_CHARS  = 4000;

Deno.serve(async req => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const secret = Deno.env.get('EMBED_SECRET');
  if (!secret || req.headers.get('x-embed-secret') !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const input = body?.input;
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_INPUTS ||
      input.some(t => typeof t !== 'string' || !t.trim())) {
    return Response.json({ error: `input must be 1–${MAX_INPUTS} non-empty strings` }, { status: 400 });
  }

  const embeddings: number[][] = [];
  for (const text of input) {
    embeddings.push(await model.run(text.slice(0, MAX_CHARS), { mean_pool: true, normalize: true }) as number[]);
  }
  return Response.json({ model: 'gte-small', embeddings });
});
