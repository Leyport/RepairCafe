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
const admin = require('firebase-admin');

admin.initializeApp();

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
  const headerType = (res.headers.get('content-type') || '').split(';')[0].trim();
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_PHOTO_BYTES) throw new Error(`too large (${buf.length} bytes)`);
  // Some stored photos (e.g. imported ones) have no proper content type
  // ("application/octet-stream"), so recognise the image from its bytes instead.
  const mimeType = sniffImageType(buf) || (headerType.startsWith('image/') ? headerType : '');
  if (!mimeType) throw new Error(`not an image (${headerType || 'unknown type'})`);
  return { inlineData: { mimeType, data: buf.toString('base64') } };
}

/** Identifies common image formats from their first bytes; '' if not recognised. */
function sniffImageType(buf) {
  if (buf.length < 12) return '';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (/^(heic|heix|hevc|hevx)$/.test(brand)) return 'image/heic';
    if (/^(mif1|msf1|heif)$/.test(brand)) return 'image/heif';
  }
  return '';
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

/**
 * deleteUserAccount — admin-only. Deletes a person's sign-in account and the personal data the
 * app holds about them: their profile (users), approval (volunteers), admin record (admins) and
 * their entries in the activity log. Repair records are left alone (they belong to the café).
 * Called from Admin → Users with { uid }.
 */
exports.deleteUserAccount = onCall({ region: 'us-central1' }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Please sign in.');
  const db = admin.firestore();
  const callerIsAdmin = (await db.doc(`admins/${callerUid}`).get()).exists;
  if (!callerIsAdmin) throw new HttpsError('permission-denied', 'Only admins can delete users.');

  const uid = typeof request.data?.uid === 'string' ? request.data.uid.trim() : '';
  if (!uid) throw new HttpsError('invalid-argument', 'No user given.');
  if (uid === callerUid) throw new HttpsError('failed-precondition', "You can't delete your own account here.");

  // Sign-in account (may already be gone, e.g. if only the profile was left behind).
  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') {
      logger.error('Auth delete failed', { uid, error: String(e) });
      throw new HttpsError('internal', 'Could not delete the sign-in account.');
    }
  }

  await Promise.all(['users', 'volunteers', 'admins'].map(col => db.doc(`${col}/${uid}`).delete()));

  // Activity log entries, in batches.
  let removed = 0;
  for (;;) {
    const snap = await db.collection('activity').where('uid', '==', uid).limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    removed += snap.size;
  }

  logger.info('User deleted', { uid, by: callerUid, activityRemoved: removed });
  return { ok: true, activityRemoved: removed };
});
