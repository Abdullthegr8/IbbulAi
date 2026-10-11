/**
 * LLM Provider Abstraction
 * Switch via admin settings (stored in system_config table).
 * Falls back to .env if DB not available.
 */

import Groq from 'groq-sdk';
import { getConfig } from '../services/configService.js';

const DEFAULT_PROVIDER = 'groq';
const DEFAULT_MODEL    = 'qwen/qwen3-32b';

// Models offered in the admin settings panel
export const GROQ_MODELS = ['qwen/qwen3-32b', 'llama-3.1-8b-instant', 'compound-beta'];

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
  return /qwen3|deepseek-r1/i.test(model);
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

const providers = {
  async groq(messages) {
    const model = getConfig('groq_model') || DEFAULT_MODEL;
    const res = await groqClient().chat.completions.create({
      model,
      messages,
      temperature: 0.6,
      // Reasoning tokens count toward this limit, so leave room for the answer
      max_tokens: 4096,
      ...(supportsReasoningFormat(model) && { reasoning_format: 'parsed' }),
    });

    const msg = res.choices[0].message;
    const { answer, reasoning: inlineReasoning } = splitThinking(msg.content || '');
    return {
      text:      answer,
      reasoning: (msg.reasoning || inlineReasoning || '').trim(),
      provider:  'Groq',
      model,
    };
  },
};

export const SUPPORTED_PROVIDERS = Object.keys(providers);

export async function chat(messages) {
  let provider = getConfig('llm_provider') || DEFAULT_PROVIDER;
  if (!providers[provider]) {
    // Don't let a bad saved setting take the whole chatbot down
    console.warn(`[LLM] Provider "${provider}" is not implemented — falling back to ${DEFAULT_PROVIDER}`);
    provider = DEFAULT_PROVIDER;
  }
  return providers[provider](messages);
}

export function getProviderInfo() {
  const provider = getConfig('llm_provider') || DEFAULT_PROVIDER;
  return {
    provider: providers[provider] ? provider : DEFAULT_PROVIDER,
    model:    getConfig('groq_model') || DEFAULT_MODEL,
  };
}
