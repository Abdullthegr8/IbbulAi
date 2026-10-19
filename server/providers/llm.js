/**
 * LLM client — Groq, with one fixed model.
 * The model is set by GROQ_MODEL in server/.env (not changeable from the UI).
 */

import Groq from 'groq-sdk';

const DEFAULT_MODEL = 'qwen/qwen3.8-27b';

export function activeModel() {
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

let _groq = null;

function groqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    throw new Error('GROQ_API_KEY is not set in server/.env — get one at https://console.groq.com');
  }
  if (!_groq) _groq = new Groq({ apiKey });
  return _groq;
}

// Reasoning models that accept Groq's `reasoning_format` parameter
function supportsReasoningFormat(model) {
  return /qwen3|deepseek-r1|gpt-oss/i.test(model);
}

/**
 * Separate <think>…</think> blocks from the answer, in case the model
 * returns its reasoning inline instead of in a separate field.
 */
export function splitThinking(text = '') {
  const thoughts = [];
  const answer = text
    .replace(/<think>([\s\S]*?)(<\/think>|$)/gi, (_, t) => { thoughts.push(t.trim()); return ''; })
    .trim();
  return { answer, reasoning: thoughts.filter(Boolean).join('\n\n') };
}

/**
 * With `onReasoning` / `onContent` callbacks the reply is streamed and the
 * callbacks receive each piece as it arrives; the full reply is returned either way.
 */
export async function chat(messages, { signal, onReasoning, onContent } = {}) {
  const model = activeModel();
  const params = {
    model,
    messages,
    temperature: 0.6,
    // Reasoning tokens count toward this limit, so leave room for the answer
    max_tokens: 4096,
    ...(supportsReasoningFormat(model) && { reasoning_format: 'parsed' }),
  };

  let content = '', reasoning = '';
  if (onReasoning || onContent) {
    const stream = await groqClient().chat.completions.create({ ...params, stream: true }, { signal });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta || {};
      if (delta.reasoning) { reasoning += delta.reasoning; onReasoning?.(delta.reasoning); }
      if (delta.content)   { content   += delta.content;   onContent?.(delta.content); }
    }
  } else {
    const res = await groqClient().chat.completions.create(params, { signal });
    content   = res.choices[0].message.content || '';
    reasoning = res.choices[0].message.reasoning || '';
  }

  const { answer, reasoning: inlineReasoning } = splitThinking(content);
  return {
    text:      answer,
    reasoning: (reasoning || inlineReasoning || '').trim(),
    provider:  'Groq',
    model,
  };
}

export function getProviderInfo() {
  return { provider: 'groq', model: activeModel() };
}
