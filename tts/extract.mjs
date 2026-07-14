/* ============================================================
   Extract the fixed narration strings from app.js (the single
   source of truth) and emit:
     - tts/narration.json  → [{hash, tts, text}] for the Python generator
     - audio-manifest.js    → window.PENNY_AUDIO = { <hash>: 1, ... }
   The hash + clean() here MUST match app.js exactly, so a generated
   clip is found at runtime by hashing the same on-screen text.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

// Pull a top-level `const NAME = <literal>;` out of app.js by brace-matching.
function extractLiteral(name, open, close) {
  const marker = 'const ' + name + ' =';
  const at = appSrc.indexOf(marker);
  if (at < 0) throw new Error('could not find ' + name);
  let i = appSrc.indexOf(open, at);
  let depth = 0, inStr = null, esc = false;
  const start = i;
  for (; i < appSrc.length; i++) {
    const c = appSrc[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { i++; break; } }
  }
  const literal = appSrc.slice(start, i);
  // data-only literals (no calls) — safe to evaluate
  return (0, eval)('(' + literal + ')');
}

const MODULES = extractLiteral('MODULES', '[', ']');
const REFLECT = extractLiteral('REFLECT', '{', '}');
const GLOSSARY = extractLiteral('GLOSSARY', '[', ']');

// identical to app.js
const clean = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function hashStr(s) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
// only for the TTS input — the on-screen text (and hash) stay untouched
const speechify = (s) => s.replace(/¢/g, ' cents').replace(/\s+/g, ' ').trim();

const entries = [];
const seen = new Set();
function add(raw) {
  const text = clean(raw);
  if (!text) return;
  const hash = hashStr(text);
  if (seen.has(hash)) return;
  seen.add(hash);
  entries.push({ hash, tts: speechify(text), text });
}

// Mirror exactly what app.js narrates per module step:
MODULES.forEach((m) => {
  add(m.bubble + ' ' + m.intro.map((p) => p.text).join(' '));       // Watch step
  if (REFLECT[m.id]) add(REFLECT[m.id].q);                           // Think step
  add('You learned: ' + m.recap.map((r) => r.text).join(' '));      // Collect step
});
// Glossary: term + '. ' + def
GLOSSARY.forEach((g) => add(g.term + '. ' + g.def));

// Extra fixed lines narrated outside the module/glossary data (keep these
// byte-for-byte identical to the strings passed to readBtn() in app.js).
const EXTRAS = [
  'Hi there! Pick a spot on the map. Every game pays Penny Coins you can bank, grow, and spend in my shop!',
];
EXTRAS.forEach(add);

fs.mkdirSync(path.join(here), { recursive: true });
fs.writeFileSync(path.join(here, 'narration.json'), JSON.stringify(entries, null, 2));

const manifest = 'window.PENNY_AUDIO=Object.freeze(' +
  JSON.stringify(Object.fromEntries(entries.map((e) => [e.hash, 1]))) + ');\n';
fs.writeFileSync(path.join(root, 'audio-manifest.js'), manifest);

console.log('extracted ' + entries.length + ' narration strings');
console.log('  modules: ' + MODULES.length + '  glossary: ' + GLOSSARY.length);
