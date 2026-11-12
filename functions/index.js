/**
 * getRepairSuggestions — AI help for Repair Café volunteers, using Google Gemini.
 *
 * Called from the app's "Investigate (AI)" page (investigation.component.ts):
 *   First request: { itemDescription, fault, category, make, model, ageOfItem,
 *                    colour, yearOfManufacture, serialNumber, photos, provider }
 *   Follow-up:     { conversationHistory, followUpQuestion, photos, provider }
 * Returns { suggestions: string } (Markdown: headings, **bold**, lists).
 *
 * Photos are the item's Firebase Storage download URLs. They are downloaded here and
 * passed to Gemini as images, so it can actually look at the item and comment on it.
 *
 * Needs the GEMINI_API_KEY secret:  firebase functions:secrets:set GEMINI_API_KEY
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// Tried in order; the alias is a fallback in case a pinned model is retired.
const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest'];

const STORAGE_BUCKET = 'repaircafe-6792c.firebasestorage.app';
const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 7 * 1024 * 1024;
const MAX_TEXT = 4000;

const SYSTEM_PROMPT = `You are an experienced, friendly repair expert helping volunteers at a UK Repair Café, where people bring broken household items to be fixed for free.

You will be given details of an item and, often, photos of it. When photos are provided, LOOK at them carefully and say what you can see: the type of item, its condition, visible damage, the likely material and construction, any labels, model numbers or markings you can read, and anything relevant to the fault. Refer to specific things in the photos. If a photo is unclear or doesn't show what you need, say what photo would help (e.g. "a close-up of the base" or "the rating label").

Then help the volunteer repair it:
- **What it is / what I can see** (from the photos, if any)
- **Likely causes** of the problem, most likely first
- **How to diagnose** — simple checks, in order
- **How to repair** — practical step-by-step guidance, tools and any parts needed
- **Safety** — always flag mains electricity, capacitors, sharp edges, glues/solvents, food-contact surfaces (e.g. which adhesives are food-safe for a cup or plate), and when NOT to attempt a repair

Keep it practical and concise; volunteers are reading this on a phone while working. Use short sections with headings (##), bullet or numbered lists, and **bold** for key points. Use UK terms (e.g. "fuse", "PAT test", "superglue"). If the item may not be worth repairing or is unsafe, say so kindly and suggest alternatives (e.g. re-use, recycling).`;

/** Trimmed, length-capped string, or ''. */
function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, MAX_TEXT);
}

/** Only fetch images from this project's own Storage bucket. */
function isOwnStorageUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' &&
      u.hostname === 'firebasestorage.googleapis.com' &&
      u.pathname.startsWith(`/v0/b/${STORAGE_BUCKET}/o/`);
  } catch {
    return false;
  }
}

async function fetchImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const mimeType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  if (!mimeType.startsWith('image/')) throw new Error(`not an image (${mimeType})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PHOTO_BYTES) throw new Error(`too large (${buf.length} bytes)`);
  return { inlineData: { mimeType, data: buf.toString('base64') } };
}

/** Downloads the item's photos as Gemini image parts. Bad/unreachable photos are skipped. */
async function photoParts(photos) {
  const urls = (Array.isArray(photos) ? photos : [])
    .filter(u => typeof u === 'string' && isOwnStorageUrl(u))
    .slice(-MAX_PHOTOS); // most recent ones, if there are lots
  const results = await Promise.allSettled(urls.map(fetchImage));
  const parts = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') parts.push(r.value);
    else logger.warn('Skipping photo', { url: urls[i], reason: String(r.reason) });
  });
  return parts;
}

function describeItem(d) {
  const lines = [
    ['Item', d.itemDescription],
    ['Category', d.category],
    ['Make / brand', d.make],
    ['Model', d.model],
    ['Colour', d.colour],
    ['Year of manufacture', d.yearOfManufacture],
    ['Age', d.ageOfItem],
    ['Serial number', d.serialNumber],
  ].filter(([, v]) => clean(v)).map(([k, v]) => `${k}: ${clean(v)}`);
  const fault = clean(d.fault) || 'Not described.';
  return `A visitor has brought this item to the Repair Café.\n\n${lines.join('\n')}\n\nWhat's wrong with it (as reported):\n${fault}`;
}

async function callGemini(apiKey, contents) {
  let lastError;
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(90000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 404) { // model not available — try the next one
      lastError = new Error(`Model ${model} not found`);
      logger.warn(lastError.message);
      continue;
    }
    if (!res.ok) {
      logger.error('Gemini error', { model, status: res.status, body });
      throw new HttpsError('unavailable', 'The AI service returned an error. Please try again.');
    }
    const candidate = body.candidates?.[0];
    const text = (candidate?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (!text) {
      logger.error('Gemini empty response', { model, finishReason: candidate?.finishReason, promptFeedback: body.promptFeedback });
      throw new HttpsError('unavailable', 'The AI did not return an answer. Please try again.');
    }
    return text;
  }
  logger.error('No Gemini model available', { error: String(lastError) });
  throw new HttpsError('unavailable', 'The AI service is not available right now.');
}

exports.getRepairSuggestions = onCall(
  { region: 'us-central1', secrets: [GEMINI_API_KEY], memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Please sign in to use the AI helper.');
    }
    const data = request.data || {};
    if (data.provider && data.provider !== 'gemini') {
      throw new HttpsError('invalid-argument', 'Only Gemini is available.');
    }

    const images = await photoParts(data.photos);
    const imageNote = images.length
      ? `\n\n${images.length} photo(s) of the item are attached — please look at them and comment on what you can see.`
      : '';

    let contents;
    if (clean(data.followUpQuestion)) {
      const history = (Array.isArray(data.conversationHistory) ? data.conversationHistory : [])
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && clean(m.content))
        .slice(-20)
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: clean(m.content) }] }));
      contents = [
        ...history,
        { role: 'user', parts: [{ text: clean(data.followUpQuestion) + imageNote }, ...images] },
      ];
    } else {
      if (!clean(data.itemDescription) && !clean(data.fault)) {
        throw new HttpsError('invalid-argument', 'Please describe the item first.');
      }
      contents = [{ role: 'user', parts: [{ text: describeItem(data) + imageNote }, ...images] }];
    }

    const suggestions = await callGemini(GEMINI_API_KEY.value(), contents);
    logger.info('Suggestions generated', { followUp: !!data.followUpQuestion, photos: images.length, uid: request.auth.uid });
    return { suggestions };
  }
);
