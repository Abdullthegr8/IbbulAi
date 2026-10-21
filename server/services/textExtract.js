/**
 * Extracts plain text from uploaded documents so the chatbot can search them.
 * Images and legacy .doc files are stored but not searchable.
 */

import mammoth from 'mammoth';

const MAX_CHARS = 200_000;

export async function extractText(buffer, mimetype) {
  try {
    let text = '';
    if (mimetype === 'application/pdf') {
      // unpdf is pdf.js built for serverless (no native canvas package), loaded
      // only when needed so a PDF problem can't stop the server from starting
      const { extractText: extractPdfText } = await import('unpdf');
      text = (await extractPdfText(new Uint8Array(buffer))).text.join('\n\n');
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else if (mimetype === 'text/plain') {
      text = buffer.toString('utf8');
    }
    return text.replace(/\u0000/g, '').trim().slice(0, MAX_CHARS);
  } catch (err) {
    console.warn('[Extract] Could not extract text:', err.message);
    return '';
  }
}
