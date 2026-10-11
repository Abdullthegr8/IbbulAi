import { searchLocalKB } from '../services/rag.js';
import { logChat } from '../database/chatLogs.js';
import { chat } from '../providers/llm.js';
import { webSearch, webSearchAvailable } from '../services/webSearch.js';

const SYSTEM_PROMPT = `You are IbbulAI, the official intelligent assistant for Ibrahim Badamasi Babangida University (IBBU), Lapai, Niger State, Nigeria.

Your role is to help students, staff, lecturers, and prospective students with accurate information about IBBU.

## PERSONALITY & TONE
- Friendly yet professional — like a knowledgeable senior student or academic advisor
- Warm, clear, and encouraging
- Always refer to the university as "IBBU" or "Ibrahim Badamasi Babangida University, Lapai"

## RESPONSE FORMATTING RULES
You MUST format your responses properly using markdown:

- Use **bold** for important terms, deadlines, amounts, and key phrases
- Use numbered lists (1. 2. 3.) for steps, processes, and sequential instructions
- Use bullet points (- item) for non-sequential lists of items
- Use ### headers for major sections when the response covers multiple topics
- Use > blockquote for important notes or warnings
- Keep paragraphs short — 2-3 sentences maximum
- Always add a blank line between sections

### Example of good formatting:
When asked "How do I register my courses?", respond like:

### Course Registration Steps

1. **Log in** to the student portal at portal.ibbu.edu.ng using your matric number
2. **Navigate** to the Course Registration section
3. **Select** your courses for the semester
4. **Submit** your registration before the deadline

> **Important:** You must pay your school fees before you can register courses. Late registration attracts a penalty fee.

**Deadline:** Registration closes 3 weeks after resumption.

---

## TOPICS YOU HANDLE
- Admission requirements, JAMB, Post-UTME, screening
- School fees, payment procedures, Bursary
- Course registration and student portal
- Examination timetables, rules, and results
- Hostel and accommodation
- Academic calendar and semester dates
- Faculties, departments, and programmes
- Scholarships, bursaries, and financial aid
- Transcript, clearance, and graduation
- University facilities (library, ICT centre, clinic)
- General student life at IBBU

## RULES
- Respond in English only
- If context from the knowledge base is provided, use it as your primary source
- Format ALL responses with proper markdown — never respond with a wall of plain text
- If you are not certain of specific figures or dates, say so and advise the student to verify with the relevant office
- Never fabricate specific data you are not sure about
- For completely off-topic questions, gently redirect to university matters
- Always end with the <suggestions> block

## SUGGESTIONS FORMAT
Always end EVERY response with exactly this format:
<suggestions>
["Follow-up question 1?", "Follow-up question 2?", "Follow-up question 3?"]
</suggestions>`;

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CHARS = 4000;

export async function handleChat(req, res) {
  const { message, history = [] } = req.body;

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const trimmed = message.trim().slice(0, MAX_MESSAGE_CHARS);

  try {
    // Step 1: Check local KB
    const { chunks, sources, foundInKB } = await searchLocalKB(trimmed);

    // Step 1b: Web search fallback (only when enabled and configured)
    let webResults = [];
    if (!foundInKB && webSearchAvailable()) {
      try {
        webResults = await webSearch(trimmed);
      } catch (err) {
        console.warn('[Chat] Web search failed:', err.message);
      }
    }
    const usedWebSearch = webResults.length > 0;

    // Step 2: Build conversation messages
    // History comes from the client, so bound its size and shape
    const conversationHistory = (Array.isArray(history) ? history : [])
      .filter(h => h && typeof h === 'object' && (h.role === 'user' || h.role === 'assistant'))
      .slice(-MAX_HISTORY_TURNS)
      .map(h => ({
        role:    h.role,
        content: String(h.content ?? '').slice(0, MAX_HISTORY_CHARS),
      }))
      .filter(h => h.content.trim());

    let userContent = trimmed;
    if (foundInKB && chunks.length > 0) {
      userContent = `${trimmed}\n\n[CONTEXT FROM IBBU KNOWLEDGE BASE]\n${chunks.join('\n\n')}\n[END CONTEXT]`;
    } else if (usedWebSearch) {
      const web = webResults.map(r => `### ${r.title}\n${r.url}\n${r.content}`).join('\n\n');
      userContent = `${trimmed}\n\n[WEB SEARCH RESULTS — may be unofficial, cite sources and advise verifying with IBBU]\n${web}\n[END RESULTS]`;
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: userContent },
    ];

    // Step 3: Call LLM
    const { text: rawAnswer, reasoning, provider, model } = await chat(messages);

    // Step 4: Parse suggestions
    let cleanAnswer = rawAnswer.trim();
    let suggestions = [];

    const suggMatch = rawAnswer.match(/<suggestions>\s*([\s\S]*?)\s*<\/suggestions>/);
    if (suggMatch) {
      try {
        suggestions = JSON.parse(suggMatch[1].trim());
        cleanAnswer = rawAnswer.replace(/<suggestions>[\s\S]*?<\/suggestions>/, '').trim();
      } catch {
        cleanAnswer = rawAnswer.replace(/<suggestions>[\s\S]*?<\/suggestions>/, '').trim();
      }
    }

    // The model can run out of tokens while still reasoning
    if (!cleanAnswer) {
      cleanAnswer = "Sorry, I couldn't finish my answer. Please try asking again, or rephrase your question.";
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      suggestions = getFallbackSuggestions(trimmed);
    }

    suggestions = suggestions.slice(0, 3).map(s => String(s));

    // Step 5: Log
    await logChat({
      // Admin tokens aren't rows in the users table
      userId:         req.user && req.user.role !== 'admin' ? req.user.id : null,
      question:       trimmed,
      answer:         cleanAnswer,
      source:         foundInKB ? (sources[0] || 'Local KB') : usedWebSearch ? 'Web search' : `${provider} LLM`,
      provider,
      usedWebSearch,
    });

    // Step 6: Respond
    return res.json({
      answer:       cleanAnswer,
      reasoning:    reasoning || null,
      suggestions,
      foundInKB,
      usedWebSearch,
      meta:          { model, provider },
    });

  } catch (err) {
    console.error('[Chat] Error:', err);
    return res.status(500).json({
      answer:      "I'm having trouble connecting right now. Please try again in a moment.",
      suggestions: [
        'What are the admission requirements for IBBU?',
        'How do I pay my school fees?',
        'How do I register my courses?',
      ],
      error: true,
    });
  }
}

function getFallbackSuggestions(query) {
  const q = query.toLowerCase();
  if (q.includes('admission') || q.includes('apply') || q.includes('jamb'))
    return ['What documents do I need for IBBU admission?', 'What is the JAMB cut-off mark for IBBU?', 'How do I complete my clearance after admission?'];
  if (q.includes('fee') || q.includes('pay') || q.includes('bursary'))
    return ['How do I generate a fee payment invoice?', 'Can I pay school fees in instalments?', 'What is the deadline for fee payment?'];
  if (q.includes('register') || q.includes('course') || q.includes('portal'))
    return ['What is the deadline for course registration?', 'How many units can I register per semester?', 'What happens if I miss registration?'];
  if (q.includes('hostel') || q.includes('accommodation'))
    return ['What is the hostel fee at IBBU?', 'How is hostel allocation done?', 'Are there off-campus housing options near IBBU?'];
  if (q.includes('exam') || q.includes('result') || q.includes('timetable'))
    return ['How do I check my examination results?', 'What are the rules during examinations?', 'What happens if I miss an exam?'];
  return [
    'What are the admission requirements for IBBU?',
    'How do I register my courses at IBBU?',
    'What is the school fee schedule?',
  ];
}
