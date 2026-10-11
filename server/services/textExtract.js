/**
 * Extracts plain text from uploaded documents so the chatbot can search them.
 * Images and legacy .doc files are stored but not searchable.
 */

import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

const MAX_CHARS = 200_000;

export async function extractText(buffer, mimetype) {
  try {
    let text = '';
    if (mimetype === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        // Drop the "-- 1 of 3 --" page markers pdf-parse inserts
        text = (await parser.getText()).text.replace(/^-- \d+ of \d+ --$/gm, '');
      } finally {
        await parser.destroy();
      }
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
