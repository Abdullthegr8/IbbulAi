/**
 * Knowledge base search.
 *
 * Sources, searched together and ranked by keyword overlap:
 *   1. LOCAL_KB — 16 built-in IBBU entries (below)
 *   2. knowledge_base table — entries added from the admin / staff panel
 *   3. documents table — text extracted from uploaded documents
 *
 * NOTE: The built-in entries are deliberately general. They avoid specific
 * fees, cut-off marks and dates, which change every session — have the
 * relevant offices verify and extend them (via the Knowledge Base tab)
 * before relying on them.
 */

import { db } from '../database/init.js';
import { getConfig } from './configService.js';

const LOCAL_KB = [
  {
    topic: 'Admission requirements', source: 'IBBU Admissions Guide',
    keywords: ['admission', 'admit', 'requirements', 'jamb', 'utme', 'post-utme', 'screening', 'apply', 'application', 'olevel', "o'level", 'waec', 'neco', 'direct', 'entry'],
    answer: `Undergraduate admission to IBBU is through JAMB (UTME or Direct Entry). Candidates generally need:
- Five O'Level credits (WAEC, NECO or NABTEB) including English Language and Mathematics, in not more than two sittings, with subjects relevant to the chosen programme
- An acceptable UTME score and IBBU listed as the institution of choice on JAMB CAPS
- Participation in the IBBU Post-UTME / screening exercise when announced
Direct Entry candidates use qualifying A'Level, ND, NCE or equivalent results. Cut-off marks and subject combinations vary by programme and session — confirm on the official IBBU website or with the Admissions Office.`,
  },
  {
    topic: 'School fees', source: 'Bursary Department',
    keywords: ['fee', 'fees', 'school', 'tuition', 'payment', 'pay', 'bursary', 'invoice', 'remita', 'charges', 'amount', 'cost'],
    answer: `School fees are paid online. Generate a payment invoice from the student portal, then pay through the approved payment channel shown on the invoice (bank or online payment). Keep your receipt — it is required for course registration and clearance. Fee amounts differ by programme, level and student category (e.g. indigene / non-indigene) and are reviewed each session, so check the current fee schedule on the portal or with the Bursary Department.`,
  },
  {
    topic: 'Course registration', source: 'Academic Affairs',
    keywords: ['course', 'courses', 'registration', 'register', 'units', 'credit', 'semester', 'form', 'add', 'drop', 'carryover'],
    answer: `Course registration is done each semester on the student portal after fees are paid:
1. Log in to the student portal with your matric number
2. Open course registration and select your core, elective and any carry-over courses
3. Stay within the unit limits set by your department
4. Submit, print the course form and get it signed by your level adviser / HOD as required
Registration closes on a date announced by Academic Affairs — late registration may attract a penalty or not be allowed.`,
  },
  {
    topic: 'Examinations', source: 'Examination Unit',
    keywords: ['exam', 'exams', 'examination', 'timetable', 'test', 'result', 'results', 'grade', 'gpa', 'cgpa', 'malpractice', 'missed'],
    answer: `Examination timetables are published by the Examination Unit / your faculty before each exam period. To sit an exam you must have registered the course and meet attendance requirements. Bring your ID card and exam card; phones and unauthorised materials are not allowed — examination malpractice attracts serious sanctions. Results are released through the student portal after approval by Senate. If you miss an exam for a genuine reason (e.g. illness), report to your department immediately with documentary evidence.`,
  },
  {
    topic: 'Hostel accommodation', source: 'Student Affairs',
    keywords: ['hostel', 'accommodation', 'room', 'bedspace', 'housing', 'lodge', 'stay', 'campus', 'residence'],
    answer: `On-campus hostel spaces are limited and allocated by the Student Affairs Division, usually through the student portal at the start of the session, after school fees are paid. Allocation is often first-come, first-served with priority rules set by Student Affairs. Many students live off-campus in Lapai town. Check the portal and Student Affairs notices for the current application window and hostel charges.`,
  },
  {
    topic: 'Transcript', source: 'Registrar Office',
    keywords: ['transcript', 'transcripts', 'academic', 'record', 'statement', 'result'],
    answer: `Transcripts are processed by the Registry (Academic Office). Apply through the official transcript application channel, pay the transcript fee, and provide the destination address (institution or email). Processing time depends on verification of your records — apply early if you have a deadline. Contact the Registrar's Office for current fees and delivery options.`,
  },
  {
    topic: 'Scholarships', source: 'Student Affairs',
    keywords: ['scholarship', 'scholarships', 'bursary', 'grant', 'financial', 'aid', 'sponsorship', 'award'],
    answer: `Scholarship and bursary opportunities for IBBU students may come from the Niger State Government, federal agencies, corporate bodies and NGOs. Announcements are made through Student Affairs and official university notices. Typical requirements include good academic standing, a valid matric number and proof of registration. Beware of anyone asking you to pay for a "scholarship". Contact Student Affairs for current opportunities.`,
  },
  {
    topic: 'Clearance documents', source: 'Admissions Office',
    keywords: ['clearance', 'documents', 'acceptance', 'screening', 'verification', 'fresher', 'freshers', 'new', 'student'],
    answer: `Newly admitted students complete clearance before registration. Commonly required documents include:
- JAMB admission letter and UTME / Direct Entry result slip
- O'Level result(s) and the scratch cards for online verification
- Birth certificate or declaration of age
- Certificate / letter of state and local government of origin
- Passport photographs
- Acceptance fee payment receipt
Bring originals and photocopies. Confirm the current list with the Admissions Office, as requirements can change.`,
  },
  {
    topic: 'Student portal', source: 'ICT Centre',
    keywords: ['portal', 'login', 'password', 'account', 'matric', 'online', 'website', 'reset'],
    answer: `The student portal is used for fee invoices, course registration, hostel applications and results. Log in with your matric number (or application number before matriculation). If you forget your password, use the portal's reset option; if that fails, visit the ICT Centre with your ID card. Never share your portal password.`,
  },
  {
    topic: 'Library', source: 'University Library',
    keywords: ['library', 'books', 'borrow', 'reading', 'ebooks', 'journals', 'research', 'study'],
    answer: `The University Library provides books, journals, reading spaces and access to electronic resources. Register with the library using your student ID to borrow materials. Borrowed items must be returned on time to avoid fines. Ask the library staff about e-library access, opening hours during exams, and help with research.`,
  },
  {
    topic: 'ICT Centre', source: 'ICT Centre',
    keywords: ['ict', 'internet', 'wifi', 'wi-fi', 'computer', 'email', 'network', 'technical', 'support'],
    answer: `The ICT Centre manages the university's network, student portal and technical support. Visit the ICT Centre for portal access problems, account issues and campus internet access. Bring your student ID card when requesting support.`,
  },
  {
    topic: 'Graduation', source: 'Academic Affairs',
    keywords: ['graduation', 'graduate', 'convocation', 'certificate', 'final', 'degree', 'nysc', 'clearance', 'statement'],
    answer: `To graduate you must pass all required courses and meet the minimum credit units for your programme, then complete final-year clearance (departments, library, bursary, student affairs, etc.). Graduating students are mobilised for NYSC through the university. Convocation dates are announced by the University; certificates are collected from the Registry after convocation, while a statement of result can be requested before then.`,
  },
  {
    topic: 'Academic calendar', source: 'Academic Affairs',
    keywords: ['calendar', 'session', 'semester', 'resumption', 'resume', 'holiday', 'break', 'dates', 'when'],
    answer: `The academic session has two semesters (first and second). Resumption, registration deadlines, lecture periods, examinations and breaks are set in the academic calendar approved by Senate and published each session. Dates can change, so always check the current calendar on the official website or Academic Affairs notices.`,
  },
  {
    topic: 'Faculties & departments', source: 'Academic Affairs',
    keywords: ['faculty', 'faculties', 'department', 'departments', 'programme', 'programmes', 'program', 'courses', 'offered', 'study'],
    answer: `IBBU runs undergraduate programmes across several faculties covering areas such as agriculture, arts, education, management and social sciences, and natural and applied sciences. Programmes and their accreditation status change over time — see the official IBBU website or Academic Affairs for the current list of faculties, departments and programmes.`,
  },
  {
    topic: 'General university info', source: 'University Overview',
    keywords: ['ibbu', 'university', 'about', 'history', 'location', 'where', 'lapai', 'founded', 'established', 'vice-chancellor', 'vc', 'contact'],
    answer: `Ibrahim Badamasi Babangida University (IBBU) is a Niger State Government-owned university located in Lapai, Niger State, Nigeria. It was established in 2005 and is named after General Ibrahim Badamasi Babangida. For official announcements, contacts and leadership information, visit the university's official website.`,
  },
  {
    topic: 'Postgraduate programmes', source: 'Postgraduate School',
    keywords: ['postgraduate', 'pg', 'masters', 'msc', 'ma', 'phd', 'pgd', 'doctorate'],
    answer: `Postgraduate programmes (such as PGD, Master's and PhD, where available) are administered by the Postgraduate School. Admission requires a relevant first degree with the required class of degree, transcripts and other documents specified in the application. Applications are made when the Postgraduate School advertises admission — check its notices for available programmes, requirements and deadlines.`,
  },
];

const STOPWORDS = new Set(('a an the is are was were be been to of in on at for and or but how what when where which who why do does did can could i my me you your we our it its this that with from by as about please tell know get want need ibbu university').split(' '));

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9'\-]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

// Matches "fee" ↔ "fees", "register" ↔ "registration" etc. without a stemmer
function matches(token, word) {
  if (token === word) return true;
  const min = Math.min(token.length, word.length);
  return min >= 4 && (token.startsWith(word.slice(0, min)) || word.startsWith(token.slice(0, min))) &&
         Math.abs(token.length - word.length) <= 5;
}

function score(queryTokens, words) {
  let s = 0;
  for (const q of queryTokens) if (words.some(w => matches(q, w))) s++;
  return s;
}

// Best ~800-char window of a document around the query terms
function bestSnippet(content, queryTokens) {
  const text = content.replace(/\s+/g, ' ');
  if (text.length <= 800) return text;
  const lower = text.toLowerCase();
  const hit = queryTokens.map(t => lower.indexOf(t)).filter(i => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - 200);
  return (start > 0 ? '…' : '') + text.slice(start, start + 800) + '…';
}

export async function searchLocalKB(query) {
  const queryTokens = tokenize(query);
  const topK = Number(getConfig('rag_top_k')) || 5;
  if (queryTokens.length === 0) return { chunks: [], sources: [], foundInKB: false };

  const candidates = LOCAL_KB.map(e => ({
    score:  score(queryTokens, [...e.keywords, ...tokenize(e.topic)]),
    source: e.source,
    chunk:  `### ${e.topic} (source: ${e.source})\n${e.answer}`,
  }));

  try {
    const [kbRows, docRows] = await Promise.all([
      db.query('SELECT question, answer, category FROM knowledge_base WHERE active = TRUE'),
      db.query(`SELECT name, category, description, content FROM documents
                WHERE content IS NOT NULL AND content <> ''`),
    ]);
    for (const r of kbRows.rows) {
      candidates.push({
        // Admin-curated entries rank slightly above built-in ones on ties
        score:  score(queryTokens, tokenize(`${r.question} ${r.category}`)) + 0.5,
        source: `Knowledge Base — ${r.category}`,
        chunk:  `### ${r.question} (source: IBBU Knowledge Base)\n${r.answer}`,
      });
    }
    for (const d of docRows.rows) {
      const s = score(queryTokens, tokenize(`${d.name} ${d.description} ${d.category}`)) +
                score(queryTokens, tokenize(d.content.slice(0, 20000))) * 0.5;
      candidates.push({
        score:  s,
        source: `Document — ${d.name}`,
        chunk:  `### From document "${d.name}"\n${bestSnippet(d.content, queryTokens)}`,
      });
    }
  } catch {
    // Database unavailable — fall back to the built-in entries only
  }

  const ranked = candidates
    .filter(c => c.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    chunks:    ranked.map(c => c.chunk),
    sources:   ranked.map(c => c.source),
    foundInKB: ranked.length > 0,
  };
}
