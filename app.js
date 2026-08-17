/* Penny’s Money Adventure — 10x picture-book rebuild */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null) node.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => { if (c) node.appendChild(c); });
    return node;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function prefersReduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* ================================================================
     SAVE — same key + shape as the original
     ================================================================ */
  const SAVE_KEY = "penny-save-v2";
  const LEGACY_PROGRESS_KEY = "penny-progress-v1";
  const FONT_KEY = "penny-easyread";

  const DEFAULT_STATE = {
    welcomed: false,
    name: "",
    avatar: "🦊",
    badges: [],
    coins: 0,
    totalEarned: 0,
    bank: { balance: 0, lastTs: 0 },
    bankEarned: 0,
    owned: [],
    equipped: {},
    activityCleared: {},
    questDone: false,
    questBest: 0,
    lastAllowance: "",
    unseenInterest: 0,
    lastChallenge: "",
    kindnessGiven: 0,
    voiceName: "",
    sound: true,
  };

  let state = loadState();

  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* fresh */ }
    if (!s || typeof s !== "object") {
      s = JSON.parse(JSON.stringify(DEFAULT_STATE));
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_PROGRESS_KEY));
        if (Array.isArray(legacy)) {
          s.badges = legacy;
          legacy.forEach((id) => { s.activityCleared[id] = true; });
          s.coins = legacy.length * 15;
          s.totalEarned = s.coins;
        }
      } catch (e) { /* no legacy */ }
    }
    for (const [k, v] of Object.entries(DEFAULT_STATE)) {
      if (s[k] === undefined) s[k] = JSON.parse(JSON.stringify(v));
    }
    return s;
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* private */ }
  }

  /* ================================================================
     SOUND
     ================================================================ */
  const AC = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function tone(freq, dur, type, gain, delay) {
    if (!state.sound || !AC) return;
    try {
      audioCtx = audioCtx || new AC();
      const t0 = audioCtx.currentTime + (delay || 0);
      const osc = audioCtx.createOscillator();
      const vol = audioCtx.createGain();
      osc.type = type || "sine";
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(gain || 0.12, t0);
      vol.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(vol).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    } catch (e) { /* blocked */ }
  }

  const sfx = {
    coin() { tone(880, 0.09, "square", 0.07); tone(1320, 0.14, "square", 0.05, 0.06); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, "triangle", 0.11, i * 0.09)); },
    big() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, "triangle", 0.12, i * 0.1)); },
    oops() { tone(240, 0.18, "sawtooth", 0.06); },
    pop() { tone(620, 0.06, "sine", 0.1); },
  };

  /* ================================================================
     ART — Penny, coins, plants, landmarks
     ================================================================ */
  function coinSVG(px) {
    const s = px || 28;
    return `<svg class="coin-svg" width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#f2b41c" stroke="#c48e0c" stroke-width="4"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#ffe27a" stroke-width="3"/>
      <text x="32" y="40" text-anchor="middle" font-size="22" font-family="Fredoka, sans-serif" font-weight="700" fill="#7a5200">¢</text>
    </svg>`;
  }

  function accSVG(id) {
    const map = {
      bow: `<path d="M8 42 C-2 16 30 10 40 34 C50 10 82 16 72 42 C58 54 46 46 40 42 C34 46 22 54 8 42Z" fill="#e05656"/><circle cx="40" cy="42" r="8" fill="#ffd0d8"/>`,
      flower: `<circle cx="40" cy="40" r="8" fill="#ffd24a"/><circle cx="40" cy="22" r="9" fill="#f7a8c4"/><circle cx="58" cy="34" r="9" fill="#f7a8c4"/><circle cx="22" cy="34" r="9" fill="#f7a8c4"/><circle cx="26" cy="54" r="9" fill="#f7a8c4"/><circle cx="54" cy="54" r="9" fill="#f7a8c4"/>`,
      cap: `<path d="M16 44 L64 44 L58 24 C50 14 30 14 22 24Z" fill="#3b7dd8"/><rect x="8" y="42" width="64" height="10" rx="4" fill="#2458a0"/>`,
      shades: `<rect x="6" y="34" width="68" height="6" rx="2" fill="#2a2a2a"/><rect x="8" y="28" width="28" height="20" rx="7" fill="#2a2a2a"/><rect x="44" y="28" width="28" height="20" rx="7" fill="#2a2a2a"/><path d="M12 32 L32 38" stroke="#8ecfff" stroke-width="3"/>`,
      tophat: `<rect x="18" y="10" width="44" height="28" rx="3" fill="#2a2a2a"/><rect x="8" y="36" width="64" height="10" rx="4" fill="#2a2a2a"/><rect x="18" y="32" width="44" height="6" fill="#8e7cf2"/>`,
      crown: `<path d="M10 50 L10 24 L26 38 L40 12 L54 38 L70 24 L70 50Z" fill="#f2b41c" stroke="#c48e0c" stroke-width="3"/><circle cx="40" cy="20" r="5" fill="#e05656"/><circle cx="18" cy="30" r="4" fill="#3b7dd8"/><circle cx="62" cy="30" r="4" fill="#2e9d5c"/>`,
      balloon: `<ellipse cx="40" cy="28" rx="16" ry="22" fill="#e05656"/><path d="M40 50 Q38 64 44 78" fill="none" stroke="#8a3030" stroke-width="2"/><path d="M32 46 L40 52 L48 46" fill="#c04050"/>`,
      wand: `<rect x="36" y="18" width="8" height="52" rx="3" transform="rotate(-28 40 44)" fill="#8e7cf2"/><polygon points="18,10 28,2 32,14 44,10 34,20 42,32 28,24 18,34 24,20 8,16" fill="#f2b41c"/>`,
      grad: `<polygon points="40,8 8,32 40,48 72,32" fill="#2a2a2a"/><rect x="16" y="32" width="48" height="8" fill="#2a2a2a"/><rect x="68" y="30" width="5" height="24" fill="#f2b41c"/>`,
      rainbow: `<path d="M8 58 A32 32 0 0 1 72 58" fill="none" stroke="#e05656" stroke-width="6"/><path d="M16 58 A24 24 0 0 1 64 58" fill="none" stroke="#f2b41c" stroke-width="6"/><path d="M24 58 A16 16 0 0 1 56 58" fill="none" stroke="#2e9d5c" stroke-width="6"/><path d="M32 58 A8 8 0 0 1 48 58" fill="none" stroke="#3b7dd8" stroke-width="6"/>`,
    };
    return map[id] || "";
  }

  function faceBits(expr) {
    if (expr === "cheer") {
      return `<path d="M70 100 Q82 92 92 100" fill="none" stroke="#3a2718" stroke-width="4" stroke-linecap="round"/>
        <path d="M110 100 Q120 92 132 100" fill="none" stroke="#3a2718" stroke-width="4" stroke-linecap="round"/>
        <path d="M86 148 Q100 164 114 148" fill="#c04060"/>
        <circle cx="58" cy="128" r="8" fill="#f7a8c4" opacity="0.85"/>
        <circle cx="142" cy="128" r="8" fill="#f7a8c4" opacity="0.85"/>`;
    }
    if (expr === "think") {
      return `<ellipse cx="86" cy="98" rx="9" ry="11" fill="#fff"/><ellipse cx="122" cy="92" rx="9" ry="11" fill="#fff"/>
        <circle cx="88" cy="94" r="4.5" fill="#3a2718"/><circle cx="125" cy="88" r="4.5" fill="#3a2718"/>
        <path d="M92 150 Q100 154 110 150" fill="none" stroke="#3a2718" stroke-width="3" stroke-linecap="round"/>
        <path d="M64 78 Q72 70 84 76" fill="none" stroke="#3a2718" stroke-width="3"/>`;
    }
    if (expr === "oops") {
      return `<ellipse cx="80" cy="100" rx="11" ry="13" fill="#fff"/><ellipse cx="122" cy="100" rx="11" ry="13" fill="#fff"/>
        <circle cx="80" cy="102" r="5" fill="#3a2718"/><circle cx="122" cy="102" r="5" fill="#3a2718"/>
        <ellipse cx="100" cy="154" rx="8" ry="7" fill="#3a2718"/>
        <path d="M70 80 L78 88" stroke="#3a2718" stroke-width="3"/><path d="M132 80 L124 88" stroke="#3a2718" stroke-width="3"/>`;
    }
    if (expr === "talk") {
      return `<ellipse cx="80" cy="100" rx="10" ry="12" fill="#fff"/><ellipse cx="122" cy="100" rx="10" ry="12" fill="#fff"/>
        <circle cx="82" cy="102" r="5" fill="#3a2718"/><circle cx="124" cy="102" r="5" fill="#3a2718"/>
        <ellipse cx="100" cy="152" rx="10" ry="9" fill="#3a2718"/>
        <ellipse cx="100" cy="154" rx="6" ry="5" fill="#c04060"/>
        <circle cx="58" cy="128" r="7" fill="#f7a8c4" opacity="0.8"/>
        <circle cx="142" cy="128" r="7" fill="#f7a8c4" opacity="0.8"/>`;
    }
    return `<ellipse cx="80" cy="100" rx="10" ry="12" fill="#fff"/><ellipse cx="122" cy="100" rx="10" ry="12" fill="#fff"/>
      <circle cx="83" cy="103" r="5" fill="#3a2718"/><circle cx="125" cy="103" r="5" fill="#3a2718"/>
      <circle cx="86" cy="99" r="2" fill="#fff"/><circle cx="128" cy="99" r="2" fill="#fff"/>
      <path d="M88 150 Q100 160 112 150" fill="none" stroke="#3a2718" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="58" cy="128" r="7" fill="#f7a8c4" opacity="0.75"/>
      <circle cx="142" cy="128" r="7" fill="#f7a8c4" opacity="0.75"/>`;
  }

  function pennyMarkup(expr, px, equipped) {
    const size = px || 120;
    const gear = equipped || state.equipped || {};
    const mood = expr || "idle";
    const img = mood === "cheer" ? "assets/penny-cheer.png" : "assets/penny-idle.png";
    const acc = Object.entries(gear).map(([slot, id]) => {
      if (!id) return "";
      return `<span class="penny-acc acc-${slot} acc-${id}" aria-hidden="true"><svg viewBox="0 0 80 80" width="100%" height="100%">${accSVG(id)}</svg></span>`;
    }).join("");
    return `<span class="penny-wrap penny-${mood}" style="width:${size}px" role="img" aria-label="Penny the piggy bank, ${mood}">
      <img class="penny-portrait" src="${img}" alt="" width="${size}" height="${size}">
      ${acc}
    </span>`;
  }

  function pennyEl(px, expr) {
    const wrap = el("span");
    wrap.innerHTML = pennyMarkup(expr || "idle", px, state.equipped);
    return wrap.firstChild;
  }

  function plantSVG(stage) {
    const s = Math.max(0, Math.min(10, stage | 0));
    const trees = [
      `<ellipse cx="80" cy="170" rx="50" ry="10" fill="#c9a05e"/><circle cx="80" cy="168" r="8" fill="#8a6230"/>`,
      `<ellipse cx="80" cy="170" rx="50" ry="10" fill="#c9a05e"/><rect x="76" y="140" width="8" height="30" fill="#7a4a20"/><path d="M80 140 C70 120 90 118 80 140" fill="#6fb248"/>`,
      `<ellipse cx="80" cy="170" rx="50" ry="10" fill="#c9a05e"/><rect x="76" y="128" width="8" height="42" fill="#7a4a20"/><ellipse cx="80" cy="118" rx="16" ry="20" fill="#6fb248"/>`,
      `<ellipse cx="80" cy="170" rx="50" ry="10" fill="#c9a05e"/><rect x="75" y="110" width="10" height="60" fill="#7a4a20"/><ellipse cx="80" cy="104" rx="22" ry="26" fill="#5aa338"/>`,
      `<ellipse cx="80" cy="170" rx="50" ry="10" fill="#c9a05e"/><rect x="74" y="100" width="12" height="70" fill="#7a4a20"/><ellipse cx="68" cy="96" rx="20" ry="24" fill="#5aa338"/><ellipse cx="94" cy="92" rx="18" ry="22" fill="#6fb248"/>`,
      `<ellipse cx="80" cy="170" rx="52" ry="10" fill="#c9a05e"/><rect x="73" y="88" width="14" height="82" fill="#7a4a20"/><ellipse cx="64" cy="86" rx="24" ry="28" fill="#4d8a32"/><ellipse cx="98" cy="80" rx="22" ry="26" fill="#6fb248"/><ellipse cx="80" cy="70" rx="20" ry="22" fill="#5aa338"/>`,
      `<ellipse cx="80" cy="170" rx="54" ry="10" fill="#c9a05e"/><rect x="72" y="78" width="16" height="92" fill="#7a4a20"/><ellipse cx="58" cy="78" rx="26" ry="30" fill="#4d8a32"/><ellipse cx="104" cy="72" rx="26" ry="30" fill="#6fb248"/><ellipse cx="80" cy="58" rx="24" ry="26" fill="#5aa338"/>`,
      `<ellipse cx="80" cy="172" rx="56" ry="10" fill="#c9a05e"/><rect x="72" y="70" width="16" height="102" fill="#6a4018"/><ellipse cx="52" cy="72" rx="28" ry="32" fill="#3f7a28"/><ellipse cx="110" cy="66" rx="28" ry="32" fill="#5aa338"/><ellipse cx="80" cy="48" rx="26" ry="28" fill="#6fb248"/>`,
      `<ellipse cx="80" cy="172" rx="58" ry="10" fill="#c9a05e"/><rect x="70" y="60" width="20" height="112" fill="#6a4018"/><ellipse cx="48" cy="64" rx="32" ry="36" fill="#3f7a28"/><ellipse cx="114" cy="58" rx="32" ry="36" fill="#5aa338"/><ellipse cx="80" cy="40" rx="30" ry="32" fill="#6fb248"/><circle cx="58" cy="70" r="5" fill="#f2b41c"/><circle cx="108" cy="62" r="5" fill="#f2b41c"/>`,
      `<ellipse cx="80" cy="172" rx="60" ry="10" fill="#c9a05e"/><rect x="70" y="52" width="20" height="120" fill="#6a4018"/><ellipse cx="44" cy="58" rx="34" ry="38" fill="#3f7a28"/><ellipse cx="118" cy="52" rx="34" ry="38" fill="#5aa338"/><ellipse cx="80" cy="32" rx="32" ry="34" fill="#6fb248"/><circle cx="50" cy="64" r="5" fill="#f2b41c"/><circle cx="112" cy="50" r="5" fill="#f2b41c"/><circle cx="80" cy="40" r="5" fill="#f2b41c"/>`,
      `<ellipse cx="80" cy="172" rx="62" ry="10" fill="#c9a05e"/><rect x="68" y="48" width="24" height="124" fill="#6a4018"/><ellipse cx="40" cy="52" rx="36" ry="40" fill="#3f7a28"/><ellipse cx="122" cy="46" rx="36" ry="40" fill="#5aa338"/><ellipse cx="80" cy="26" rx="34" ry="36" fill="#6fb248"/><circle cx="46" cy="58" r="6" fill="#f2b41c"/><circle cx="116" cy="44" r="6" fill="#f2b41c"/><circle cx="80" cy="30" r="6" fill="#f2b41c"/><circle cx="64" cy="20" r="4" fill="#ffe27a"/>`,
    ];
    return `<svg class="plant-stage" viewBox="0 0 160 200" role="img" aria-label="Savings plant, year ${s}">${trees[s]}</svg>`;
  }

  function iconSVG(kind) {
    const icons = {
      coin: `<circle cx="16" cy="16" r="13" fill="#f2b41c" stroke="#c48e0c" stroke-width="2"/><text x="16" y="21" text-anchor="middle" font-size="12" fill="#7a5200" font-weight="700">¢</text>`,
      apple: `<path d="M16 8 C20 2 26 8 22 12 C28 12 30 28 16 30 C2 28 4 12 10 12 C6 8 12 2 16 8Z" fill="#e05656"/><path d="M16 8 C16 2 22 2 22 8" fill="none" stroke="#4d8a32" stroke-width="2"/>`,
      work: `<rect x="6" y="14" width="20" height="14" rx="2" fill="#3b7dd8"/><path d="M10 14 V10 H22 V14" fill="none" stroke="#2458a0" stroke-width="3"/>`,
      jars: `<rect x="3" y="10" width="8" height="16" rx="2" fill="#2e9d5c"/><rect x="12" y="10" width="8" height="16" rx="2" fill="#3b7dd8"/><rect x="21" y="10" width="8" height="16" rx="2" fill="#f2b41c"/>`,
      chart: `<rect x="6" y="18" width="5" height="10" fill="#3b7dd8"/><rect x="14" y="12" width="5" height="16" fill="#2e9d5c"/><rect x="22" y="8" width="5" height="20" fill="#f2b41c"/>`,
      plant: `<rect x="14" y="16" width="4" height="12" fill="#7a4a20"/><ellipse cx="16" cy="14" rx="8" ry="10" fill="#6fb248"/>`,
      goal: `<circle cx="16" cy="16" r="12" fill="none" stroke="#3b7dd8" stroke-width="3"/><circle cx="16" cy="16" r="6" fill="none" stroke="#e05656" stroke-width="3"/><circle cx="16" cy="16" r="2" fill="#f2b41c"/>`,
      lemon: `<ellipse cx="16" cy="16" rx="12" ry="10" fill="#f2b41c" transform="rotate(-20 16 16)"/><circle cx="8" cy="12" r="2" fill="#e0a020"/>`,
      shield: `<path d="M16 4 L28 10 V18 C28 26 16 30 16 30 C16 30 4 26 4 18 V10Z" fill="#8e7cf2" stroke="#5a4ab8" stroke-width="2"/>`,
      bank: `<rect x="4" y="14" width="24" height="14" fill="#2e9d5c"/><polygon points="16,4 2,14 30,14" fill="#1d6d3e"/><rect x="13" y="18" width="6" height="10" fill="#fff8ee"/>`,
      shop: `<rect x="4" y="12" width="24" height="16" fill="#3b7dd8"/><path d="M2 12 H30 L26 6 H6Z" fill="#e05656"/><rect x="12" y="18" width="8" height="10" fill="#fff8ee"/>`,
      heart: `<path d="M16 28 C16 28 4 18 4 12 C4 7 8 4 12 6 C14 7 16 10 16 10 C16 10 18 7 20 6 C24 4 28 7 28 12 C28 18 16 28 16 28Z" fill="#e05656"/>`,
      castle: `<rect x="4" y="14" width="24" height="16" fill="#8e7cf2"/><rect x="6" y="6" width="6" height="10" fill="#6a58c8"/><rect x="20" y="6" width="6" height="10" fill="#6a58c8"/><rect x="13" y="18" width="6" height="12" fill="#fff8ee"/>`,
      lock: `<rect x="8" y="14" width="16" height="12" rx="2" fill="#6a5340"/><path d="M11 14 V10 A5 5 0 0 1 21 10 V14" fill="none" stroke="#6a5340" stroke-width="3"/>`,
      star: `<polygon points="16,3 19,12 28,12 21,18 24,27 16,21 8,27 11,18 4,12 13,12" fill="#f2b41c"/>`,
    };
    return `<svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true">${icons[kind] || icons.coin}</svg>`;
  }

  function townBackdrop() {
    return `<svg class="town-bg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustrated Penny Town with a winding dirt path through hills">
      <defs>
        <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7ec4ea"/><stop offset="50%" stop-color="#c9e7f7"/><stop offset="100%" stop-color="#ffe7b8"/>
        </linearGradient>
        <linearGradient id="hillA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8fd15a"/><stop offset="100%" stop-color="#5aa338"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#skyG)"/>
      <circle cx="1040" cy="90" r="54" fill="#ffe27a"/>
      <g class="cloud-drift" fill="#fff" opacity="0.88">
        <ellipse cx="180" cy="90" rx="50" ry="22"/><ellipse cx="220" cy="84" rx="36" ry="20"/><ellipse cx="150" cy="88" rx="28" ry="16"/>
        <ellipse cx="620" cy="70" rx="46" ry="18"/><ellipse cx="660" cy="66" rx="30" ry="16"/>
        <ellipse cx="900" cy="120" rx="40" ry="16"/>
      </g>
      <path d="M-20 260 C160 200 280 280 420 230 C560 180 700 260 860 210 C1000 170 1140 230 1220 200 L1220 800 L-20 800Z" fill="#9ed36a" opacity="0.55"/>
      <path d="M-20 360 C140 300 300 380 480 320 C660 260 820 360 1000 300 C1100 270 1180 320 1220 300 L1220 800 L-20 800Z" fill="url(#hillA)"/>
      <path d="M-20 520 C200 460 360 560 560 500 C760 440 940 540 1220 480 L1220 800 L-20 800Z" fill="#6fb248"/>
      <path class="path-glow winding-path" d="M 180 720 C 201 707 267 669 308 644 C 350 619 391 593 431 568 C 470 543 510 517 546 492 C 582 467 616 441 648 416 C 680 391 710 365 738 340 C 766 315 790 289 815 264 C 839 239 862 213 884 188 C 907 163 937 125 948 112" />
      <path class="winding-path" d="M 180 720 C 201 707 267 669 308 644 C 350 619 391 593 431 568 C 470 543 510 517 546 492 C 582 467 616 441 648 416 C 680 391 710 365 738 340 C 766 315 790 289 815 264 C 839 239 862 213 884 188 C 907 163 937 125 948 112" fill="none" stroke="#e8c48a" stroke-width="46" stroke-linecap="round"/>
      <path d="M 180 720 C 201 707 267 669 308 644 C 350 619 391 593 431 568 C 470 543 510 517 546 492 C 582 467 616 441 648 416 C 680 391 710 365 738 340 C 766 315 790 289 815 264 C 839 239 862 213 884 188 C 907 163 937 125 948 112" fill="none" stroke="#f6d7a0" stroke-width="18" stroke-linecap="round" stroke-dasharray="10 22"/>
      <g fill="#4d8a32">
        <ellipse cx="240" cy="300" rx="28" ry="40"/><rect x="234" y="330" width="12" height="30" fill="#7a4a20"/>
        <ellipse cx="980" cy="260" rx="34" ry="48"/><rect x="973" y="300" width="14" height="36" fill="#7a4a20"/>
        <ellipse cx="70" cy="400" rx="22" ry="32"/><rect x="65" y="424" width="10" height="24" fill="#7a4a20"/>
      </g>
      <g>
        <circle cx="130" cy="500" r="5" fill="#e05656"/><circle cx="300" cy="620" r="5" fill="#f2b41c"/>
        <circle cx="520" cy="680" r="5" fill="#e05656"/><circle cx="760" cy="520" r="5" fill="#8e7cf2"/>
        <circle cx="1080" cy="420" r="5" fill="#f7a8c4"/>
      </g>
    </svg>`;
  }


  /* ================================================================
     DATA
     ================================================================ */
  const SHOP = [
    { id: "bow", name: "Cute Bow", price: 15, slot: "head", icon: "bow" },
    { id: "flower", name: "Sunny Flower", price: 15, slot: "head", icon: "flower" },
    { id: "balloon", name: "Party Balloon", price: 20, slot: "hand", icon: "balloon" },
    { id: "cap", name: "Cool Cap", price: 25, slot: "head", icon: "cap" },
    { id: "shades", name: "Star Shades", price: 30, slot: "face", icon: "shades" },
    { id: "tophat", name: "Fancy Top Hat", price: 40, slot: "head", icon: "tophat" },
    { id: "wand", name: "Magic Wand", price: 45, slot: "hand", icon: "wand" },
    { id: "grad", name: "Smarty Cap", price: 60, slot: "head", icon: "grad" },
    { id: "rainbow", name: "Pet Rainbow", price: 100, slot: "hand", icon: "rainbow" },
    { id: "crown", name: "Royal Crown", price: 150, slot: "head", icon: "crown" },
  ];

  const MODULES = [
    {
      id: "what-is-money", title: "What Is Money?", icon: "coin", color: "#8e7cf2",
      tagline: "Where did money come from?",
      pos: { x: 15.0, y: 90.0 },
      bubble: "Long ago, there was no money at all. Tap the cards to travel through time!",
      intro: [
        { icon: "apple", text: "Long ago, people swapped things. A chicken for some corn!" },
        { icon: "work", text: "But swapping was tricky. What if nobody wanted your chicken?" },
        { icon: "coin", text: "So people invented money — something everyone agrees is worth trading." },
      ],
      activity: "timeline",
      recap: [
        { icon: "work", text: "Before money, people swapped things." },
        { icon: "coin", text: "Money makes trading easy for everyone." },
        { icon: "shop", text: "Money keeps changing — even into numbers on a screen!" },
      ],
      parent: "Introduces money as a tool for exchange: bartering, why it was hard, and how coins, paper bills, and digital money evolved.",
    },
    {
      id: "needs-wants", title: "Needs vs. Wants", icon: "apple", color: "#e05656",
      tagline: "Must-haves and nice-to-haves",
      pos: { x: 25.7, y: 80.5 },
      bubble: "A NEED keeps you healthy and safe. A WANT is fun but you can live without it. Can you sort them?",
      intro: [
        { icon: "apple", text: "NEEDS are things we must have to live — food, water, a home." },
        { icon: "goal", text: "WANTS are fun extras — games, candy, toys." },
        { icon: "chart", text: "Smart savers pay for needs first, then save for wants!" },
      ],
      activity: "needsWants",
      recap: [
        { icon: "apple", text: "Needs come first: food, water, home." },
        { icon: "goal", text: "Wants are extras we can wait for." },
        { icon: "star", text: "Needs first, wants second — that is the money champion rule!" },
      ],
      parent: "Builds the core prioritization skill: distinguishing essential needs from optional wants through a sorting game.",
    },
    {
      id: "earning", title: "Earning Money", icon: "work", color: "#3b7dd8",
      tagline: "Work turns into money!",
      pos: { x: 35.9, y: 71.0 },
      bubble: "Money does not fall from the sky — people EARN it by helping and working. Try some jobs!",
      intro: [
        { icon: "work", text: "Grown-ups earn money by doing jobs that help people." },
        { icon: "plant", text: "Kids can earn too — chores, dog walking, watering plants!" },
        { icon: "coin", text: "The rule is simple: work first, money after." },
      ],
      activity: "chores",
      recap: [
        { icon: "work", text: "Money is earned by working and helping." },
        { icon: "heart", text: "Even small jobs add up to real money." },
        { icon: "jars", text: "What you earn is yours to save, spend, or share!" },
      ],
      parent: "Connects money to work and effort. Kids complete a chore board and watch small earnings add up.",
    },
    {
      id: "three-jars", title: "The 3 Jars", icon: "jars", color: "#2e9d5c",
      tagline: "Save, Spend, Share",
      pos: { x: 45.5, y: 61.5 },
      bubble: "When money arrives, split it into 3 jars: green to SAVE, blue to SPEND, yellow to SHARE. You choose how!",
      intro: [
        { icon: "bank", text: "The green SAVE jar grows your money for big dreams." },
        { icon: "shop", text: "The blue SPEND jar is for things you buy now." },
        { icon: "heart", text: "The yellow SHARE jar helps other people and animals." },
      ],
      activity: "jars",
      recap: [
        { icon: "bank", text: "Save some — future you says thanks!" },
        { icon: "shop", text: "Spend some — enjoy what you earned." },
        { icon: "heart", text: "Share some — giving feels great." },
      ],
      parent: "The classic save/spend/share allocation model. Kids drop 10 coins into three color-coded jars and reflect on their split.",
    },
    {
      id: "budgeting", title: "Make a Budget", icon: "chart", color: "#f2b41c",
      tagline: "A plan for every coin",
      pos: { x: 54.0, y: 52.0 },
      bubble: "A budget is a PLAN for your money before you spend it. You have $10 — plan every dollar!",
      intro: [
        { icon: "goal", text: "A budget is like a map — it tells your money where to go." },
        { icon: "coin", text: "Start with what you have. Today: 10 dollars." },
        { icon: "chart", text: "Give every dollar a job before you spend it!" },
      ],
      activity: "budget",
      recap: [
        { icon: "goal", text: "A budget is a plan for your money." },
        { icon: "work", text: "Every dollar gets a job." },
        { icon: "bank", text: "A good plan always includes some saving." },
      ],
      parent: "Hands-on budgeting: allocate a $10 allowance across categories with sliders and a live icon chart until the plan balances.",
    },
    {
      id: "banks-interest", title: "The Money Garden", icon: "plant", color: "#2e9d5c",
      tagline: "How banks grow your money",
      pos: { x: 61.5, y: 42.5 },
      bubble: "A bank is a super-safe piggy bank. It even pays you a little extra — called INTEREST — for keeping money there. Watch it grow!",
      intro: [
        { icon: "bank", text: "A bank keeps your money safe — safer than under your bed!" },
        { icon: "star", text: "Banks add a little extra to your savings. That gift is called interest." },
        { icon: "plant", text: "Saved money is like a seed. Leave it alone and it grows!" },
      ],
      activity: "garden",
      recap: [
        { icon: "bank", text: "Banks keep money safe." },
        { icon: "star", text: "Interest is extra money the bank adds." },
        { icon: "plant", text: "The longer you save, the bigger it grows!" },
      ],
      parent: "Introduces banks and compound growth visually: a slider moves time forward while savings (and a plant) grow. Pairs with the site-wide Penny Bank, where deposited coins earn real interest over real time.",
    },
    {
      id: "goals", title: "Super Saver Goals", icon: "goal", color: "#3b7dd8",
      tagline: "Wait for it... it is worth it!",
      pos: { x: 67.9, y: 33.0 },
      bubble: "Big things cost more than one allowance. Pick a dream, save week by week, and watch yourself get there!",
      intro: [
        { icon: "goal", text: "See something big you want? That is a savings goal!" },
        { icon: "chart", text: "Save a little every week instead of spending it all." },
        { icon: "star", text: "Waiting is hard — but reaching your goal feels AMAZING." },
      ],
      activity: "goal",
      recap: [
        { icon: "goal", text: "A goal gives your saving a purpose." },
        { icon: "plant", text: "Slow and steady saving wins." },
        { icon: "star", text: "Patience pays — literally!" },
      ],
      parent: "Teaches delayed gratification: choose a goal, simulate weekly saving, and experience progress toward a target. The Penny Shop reinforces this with big-ticket items kids must save real Penny Coins for.",
    },
    {
      id: "lemonade", title: "Lemonade Boss", icon: "lemon", color: "#f2b41c",
      tagline: "Run your own stand!",
      pos: { x: 73.7, y: 23.5 },
      bubble: "You are the boss of a lemonade stand! Each cup costs you 20¢ to make. Pick a price and see what happens!",
      intro: [
        { icon: "lemon", text: "Making things costs money. Lemons, water, cups: 20¢ per cup." },
        { icon: "shop", text: "You choose the price. Too high? Fewer people buy!" },
        { icon: "coin", text: "Money in, minus costs = PROFIT. That is business!" },
      ],
      activity: "lemonade",
      recap: [
        { icon: "chart", text: "Every business has costs." },
        { icon: "shop", text: "Price changes how many people buy." },
        { icon: "coin", text: "Profit = money in − costs." },
      ],
      parent: "Basic entrepreneurship: costs, pricing, demand, and profit through a lemonade stand simulation with instant visual results.",
    },
    {
      id: "digital-safety", title: "Money Safety Shield", icon: "shield", color: "#e05656",
      tagline: "Be smart with digital money",
      pos: { x: 79.0, y: 14.0 },
      bubble: "Money lives on screens now too! Flip each card and guess: smart move or danger zone?",
      intro: [
        { icon: "shop", text: "Money can be invisible — on cards, phones, and games." },
        { icon: "lock", text: "Passwords are secret keys. Real friends never need them." },
        { icon: "heart", text: "Golden rule: always ask a trusted grown-up before paying online." },
      ],
      activity: "safety",
      recap: [
        { icon: "lock", text: "Keep passwords secret — always." },
        { icon: "heart", text: "Ask a grown-up before buying online." },
        { icon: "shield", text: "If it feels weird, stop and tell someone." },
      ],
      parent: "Age-appropriate digital money safety: passwords, in-game purchases, scams, and always involving a trusted adult. No real transactions anywhere on this site.",
    },
  ];

  const REFLECT = {
    "what-is-money": {
      q: "Would you rather be paid for chores in CHICKENS or COINS?",
      choices: [
        ["Chickens", "Ha! But what if the toy shop does not want chickens? That is exactly why people invented coins."],
        ["Coins", "Smart! Coins work everywhere because everyone agrees they are worth something."],
      ],
    },
    "needs-wants": {
      q: "Think about YOUR life. Which one is a real NEED?",
      choices: [
        ["Food", "Yes! Food is a true need — your body cannot go without it."],
        ["A new game", "Games are a fun WANT! Needs come first, then we save up for wants."],
        ["A warm bed", "Exactly — a safe, warm place to sleep is a big need."],
      ],
    },
    earning: {
      q: "Which job could YOU really do at home this week to earn?",
      choices: [
        ["Tidy up", "Great pick! Ask a grown-up if you can help — work first, then earn."],
        ["Help a pet", "Lovely! Feeding or walking a pet is real, helpful work."],
        ["Help cook", "Yum! Setting the table or helping cook is a real way to pitch in."],
      ],
    },
    "three-jars": {
      q: "What would YOU fill your green SAVE jar for?",
      choices: [
        ["Something big", "Awesome goal! Big things take weeks of saving — and you can do it."],
        ["A gift for someone", "So kind! Saving up to give is a wonderful plan."],
        ["Just to grow it", "Love it — savers who keep their jar growing feel proud AND ready."],
      ],
    },
    budgeting: {
      q: "When your $10 was running low, what is smartest to protect?",
      choices: [
        ["Some savings", "Exactly! A great budget always keeps a little for savings."],
        ["Extra snacks", "Snacks are fun — but a money boss protects savings first!"],
      ],
    },
    "banks-interest": {
      q: "Your coins grow while you sleep. What would YOU do with 10 coins?",
      choices: [
        ["Bank them & wait", "Smart saver! Left alone, they quietly grow bigger. That is interest!"],
        ["Spend them now", "That is okay sometimes — but money left in the bank grows. Waiting can pay off!"],
      ],
    },
    goals: {
      q: "What real thing would YOU save up for?",
      choices: [
        ["Something big", "Great goal! Save a bit each week and watch it get closer."],
        ["A present", "So thoughtful! Saving up to give feels amazing."],
        ["A hobby", "Nice! A goal gives your saving a purpose."],
      ],
    },
    lemonade: {
      q: "One price sold MORE cups; another earned more PER cup. Which is smarter?",
      choices: [
        ["The best PROFIT one", "That is the boss move — the biggest PROFIT wins, not the most cups!"],
        ["The most cups", "Selling lots is exciting — but check the profit! More cups is not always more money."],
      ],
    },
    "digital-safety": {
      q: "A game says \"Enter your password for FREE coins!\" What do YOU do?",
      choices: [
        ["Stop & tell a grown-up", "PERFECT! That is a trick — you keep your password secret and always ask a grown-up."],
        ["Type my password", "Uh oh — that is a trap! Real prizes never need your secret password. Always check with a grown-up."],
      ],
    },
  };

  const QUEST_POOL = [
    { q: "Which one is a NEED?", a: [["Food", true], ["Video game", false], ["Candy", false]] },
    { q: "Which jar grows money for later?", a: [["Save jar", true], ["Spend jar", false], ["Share jar", false]] },
    { q: "How do people get money?", a: [["By working", true], ["By wishing", false], ["By napping", false]] },
    { q: "What is interest?", a: [["Extra money the bank adds to savings", true], ["A fee you pay the bank", false], ["A shopping list", false]] },
    { q: "What is a budget?", a: [["A plan for your money", true], ["Spending everything fast", false], ["Hiding coins in a hole", false]] },
    { q: "Money in is $30, costs are $6. What is the profit?", a: [["$24", true], ["$30", false], ["$6", false]] },
    { q: "A game friend asks for your password. You…", a: [["Never share it", true], ["Share it if they are nice", false], ["Trade it for coins", false]] },
    { q: "A goal costs $20. You save $4 each week. How many weeks?", a: [["5 weeks", true], ["4 weeks", false], ["10 weeks", false]] },
    { q: "Before money was invented, people…", a: [["Swapped things", true], ["Used cards", false], ["Paid by phone", false]] },
    { q: "Which one is a WANT?", a: [["A new toy", true], ["Water", false], ["A home", false]] },
    { q: "Profit = money in minus…", a: [["Costs", true], ["Wishes", false], ["Cups", false]] },
    { q: "Where is money safest?", a: [["In a bank", true], ["Under the bed", false], ["A pocket with a hole", false]] },
    { q: "A pop-up says \"FREE coins — enter your card number!\" It is…", a: [["A trick", true], ["A prize", false], ["A gift", false]] },
    { q: "A good budget gives every dollar a…", a: [["Job", true], ["Nap", false], ["Hat", false]] },
    { q: "The longer you leave savings in the bank…", a: [["The more they grow", true], ["The smaller they get", false], ["Nothing changes", false]] },
    { q: "The yellow SHARE jar is for…", a: [["Helping others", true], ["Buying candy", false], ["Game coins", false]] },
  ];
  const QUEST_LEN = 10;
  const QUEST_PASS = 8;

  const GLOSSARY = [
    { term: "Money", icon: "coin", color: "#8e7cf2", def: "What we trade for things we need and want." },
    { term: "Earn", icon: "work", color: "var(--spend)", def: "To get money by working or helping." },
    { term: "Save", icon: "bank", color: "var(--save)", def: "To keep money for later instead of spending now." },
    { term: "Spend", icon: "shop", color: "var(--spend)", def: "To use money to buy something." },
    { term: "Share", icon: "heart", color: "#c98f00", def: "To give some money to help others." },
    { term: "Need", icon: "apple", color: "#e05656", def: "Something you must have to live, like food." },
    { term: "Want", icon: "goal", color: "#e05656", def: "Something fun you can live without." },
    { term: "Budget", icon: "chart", color: "#f2b41c", def: "A plan that gives every dollar a job." },
    { term: "Bank", icon: "bank", color: "var(--save)", def: "A super-safe place that keeps your money." },
    { term: "Interest", icon: "plant", color: "var(--save)", def: "Extra money a bank adds to your savings." },
    { term: "Deposit", icon: "bank", color: "var(--save)", def: "Putting money INTO the bank." },
    { term: "Withdraw", icon: "coin", color: "var(--spend)", def: "Taking money OUT of the bank." },
    { term: "Goal", icon: "goal", color: "var(--spend)", def: "Something big you save up for." },
    { term: "Profit", icon: "coin", color: "#f2b41c", def: "The money left after paying your costs." },
    { term: "Cost", icon: "chart", color: "#e05656", def: "What you must pay to make or get something." },
    { term: "Allowance", icon: "star", color: "#f2b41c", def: "Money you get regularly, like every week." },
    { term: "Password", icon: "lock", color: "#e05656", def: "A secret key. Never share it with anyone!" },
  ];

  const BUDDIES = ["🦊", "🐼", "🦄", "🐯", "🐸", "🐙", "🦖", "🐰"];

  /* ================================================================
     WALLET / BANK / JUICE
     ================================================================ */
  function updateWallet(bump) {
    const chip = $("#walletChip");
    const count = $("#coinCount");
    if (count) count.textContent = Math.floor(state.coins);
    if (bump && chip) {
      chip.classList.remove("bump");
      void chip.offsetWidth;
      chip.classList.add("bump");
    }
  }

  function coinFly(fromEl, count) {
    if (prefersReduced()) return;
    const layer = $("#coin-layer");
    const targetEl = $("#walletChip");
    if (!layer || !targetEl) return;
    const target = targetEl.getBoundingClientRect();
    let from = { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    if (fromEl && fromEl.getBoundingClientRect) from = fromEl.getBoundingClientRect();
    const n = Math.min(count, 6);
    for (let i = 0; i < n; i++) {
      const c = el("span", { class: "fly-coin", html: coinSVG(26) });
      c.style.left = from.left + from.width / 2 + (Math.random() * 40 - 20) + "px";
      c.style.top = from.top + from.height / 2 + (Math.random() * 20 - 10) + "px";
      layer.appendChild(c);
      requestAnimationFrame(() => {
        setTimeout(() => {
          c.style.left = target.left + target.width / 2 + "px";
          c.style.top = target.top + target.height / 2 + "px";
          c.style.opacity = "0.2";
          c.style.transform = "scale(0.5)";
        }, i * 70);
      });
      setTimeout(() => c.remove(), 900 + i * 70);
    }
  }

  function awardCoins(amount, fromEl) {
    state.coins += amount;
    state.totalEarned += amount;
    save();
    coinFly(fromEl, amount >= 10 ? 6 : 3);
    sfx.coin();
    setTimeout(() => updateWallet(true), 500);
  }

  const HOURLY_RATE = 0.01;
  function accrueBank() {
    const now = Date.now();
    let gained = 0;
    if (state.bank.balance > 0 && state.bank.lastTs > 0 && now > state.bank.lastTs) {
      const hours = (now - state.bank.lastTs) / 3600000;
      const grown = state.bank.balance * Math.pow(1 + HOURLY_RATE, hours);
      gained = grown - state.bank.balance;
      state.bank.balance = grown;
      state.bankEarned += gained;
      state.unseenInterest += gained;
    }
    state.bank.lastTs = now;
    save();
    return gained;
  }

  function markComplete(id) {
    if (!state.badges.includes(id)) {
      state.badges.push(id);
      save();
    }
    updateHeaderJar();
  }

  function updateHeaderJar() {
    const fill = $("#jarFill");
    const label = $("#jarLabel");
    const done = state.badges.length;
    if (fill) fill.style.height = Math.round((done / MODULES.length) * 100) + "%";
    if (label) label.textContent = done + " / " + MODULES.length;
  }

  const CONFETTI_COLORS = ["#2e9d5c", "#3b7dd8", "#f2b41c", "#f7a8c4", "#8e7cf2"];
  function confetti() {
    if (prefersReduced()) return;
    const layer = $("#confetti-layer");
    if (!layer) return;
    for (let i = 0; i < 80; i++) {
      const c = el("div", { class: "confetto" });
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
      c.style.animationDelay = Math.random() * 0.6 + "s";
      layer.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }

  function heartFloat(fromEl) {
    if (prefersReduced() || !fromEl) return;
    const layer = $("#coin-layer");
    const r = fromEl.getBoundingClientRect();
    const glyphs = ["💖", "💛", "💗", "🌸", "✨", "💕"];
    for (let i = 0; i < 6; i++) {
      const h = el("span", { class: "float-heart", text: glyphs[i % 6] });
      h.style.left = r.left + r.width / 2 + (Math.random() * 44 - 22) + "px";
      h.style.top = r.top + r.height / 2 + "px";
      layer.appendChild(h);
      requestAnimationFrame(() => {
        setTimeout(() => {
          h.style.top = (r.top - 90 - Math.random() * 50) + "px";
          h.style.opacity = "0";
          h.style.transform = "scale(1.4)";
        }, i * 80);
      });
      setTimeout(() => h.remove(), 1300 + i * 80);
    }
  }

  /* ================================================================
     READ-ALOUD — Web Speech only
     ================================================================ */
  const VOICES = { list: [], best: null, ready: false };

  function scoreVoice(v) {
    const n = (v.name || "").toLowerCase();
    const lang = (v.lang || "").toLowerCase();
    let s = 0;
    if (lang.startsWith("en")) s += 40;
    if (lang === "en-us" || lang === "en-gb") s += 8;
    if (/natural|neural|premium|enhanced|wavenet|journey|studio|online/.test(n)) s += 60;
    if (/\bgoogle\b/.test(n)) s += 45;
    if (/siri|\baria\b|\bjenny\b|\bemma\b|\bmichelle\b|\blibby\b|\bsonia\b|\bava\b|\ballison\b|samantha/.test(n)) s += 40;
    if (v.localService === false) s += 15;
    if (/espeak|pico|compact|\bfred\b|\balbert\b|zarvox|robot/.test(n)) s -= 60;
    return s;
  }

  function loadVoices() {
    if (!("speechSynthesis" in window)) return;
    const list = window.speechSynthesis.getVoices() || [];
    if (!list.length) return;
    VOICES.list = list;
    VOICES.ready = true;
    const ranked = list.map((v) => ({ v, s: scoreVoice(v) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    VOICES.best = ranked.length ? ranked[0].v : (list.find((v) => (v.lang || "").startsWith("en")) || list[0]);
  }

  function currentVoice() {
    if (!VOICES.ready) loadVoices();
    if (state.voiceName) {
      const chosen = VOICES.list.find((v) => v.name === state.voiceName);
      if (chosen) return chosen;
    }
    return VOICES.best;
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = currentVoice();
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 0.92;
      u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    } catch (e) { /* silent */ }
  }

  function narrate(raw) {
    speak(String(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  }

  function readBtn(getText) {
    return el("button", {
      class: "read-btn",
      type: "button",
      html: "Read to me",
      onclick: () => { sfx.pop(); narrate(getText()); },
    });
  }

  function kidName() { return state.name || "Money Explorer"; }

  function speechRow(text, opts) {
    const row = el("div", { class: "speech-row" });
    row.appendChild(pennyEl(opts && opts.size ? opts.size : 110, opts && opts.expr ? opts.expr : "talk"));
    row.appendChild(el("div", { class: "speech-bubble", html: text }));
    return row;
  }

  function refreshHeaderPenny() {
    const host = $("#headerPenny");
    if (!host) return;
    host.innerHTML = pennyMarkup("idle", 56, state.equipped);
  }


  /* ================================================================
     ACTIVITIES
     ================================================================ */
  const ACTIVITIES = {
    timeline(onDone) {
      const cards = [
        { icon: "apple", text: "Swapping animals & food", num: "1" },
        { icon: "star", text: "Shiny shells as money", num: "2" },
        { icon: "coin", text: "Coins & paper bills", num: "3" },
        { icon: "shop", text: "Cards & phone money", num: "4" },
      ];
      let opened = 0;
      const wrap = el("div");
      wrap.appendChild(el("p", { class: "hint", text: "Tap each mystery card in order to see how money changed through time!" }));
      const grid = el("div", { class: "reveal-grid" });
      const cheer = el("p", { class: "cheer", "aria-live": "polite" });
      cards.forEach((c, i) => {
        const btn = el("button", { class: "reveal-card", type: "button", text: "?", "aria-label": "Mystery card " + (i + 1) });
        btn.addEventListener("click", () => {
          if (btn.classList.contains("open")) return;
          if (i !== opened) {
            cheer.textContent = "Start from card " + (opened + 1) + " — time goes in order!";
            cheer.classList.add("oops");
            btn.classList.add("shake");
            sfx.oops();
            setTimeout(() => btn.classList.remove("shake"), 450);
            return;
          }
          cheer.classList.remove("oops");
          btn.classList.add("open");
          btn.innerHTML = iconSVG(c.icon) + "<strong>" + c.num + ". " + c.text + "</strong>";
          opened++;
          sfx.pop();
          cheer.textContent = opened < cards.length ? "Nice! Keep going…" : "You unlocked the whole story of money!";
          if (opened === cards.length) onDone();
        });
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
      wrap.appendChild(cheer);
      return wrap;
    },

    needsWants(onDone) {
      const items = [
        { name: "Food", kind: "need", icon: "apple" },
        { name: "Water", kind: "need", icon: "plant" },
        { name: "A home", kind: "need", icon: "bank" },
        { name: "Warm coat", kind: "need", icon: "shield" },
        { name: "Candy", kind: "want", icon: "star" },
        { name: "Video game", kind: "want", icon: "goal" },
        { name: "New toy", kind: "want", icon: "heart" },
        { name: "Theme park", kind: "want", icon: "lemon" },
      ];
      let placed = 0;
      let selected = null;
      const wrap = el("div");
      wrap.appendChild(el("p", { class: "hint", text: "Tap a card, then tap the basket where it belongs!" }));
      const pool = el("div", { class: "sorter-pool", "aria-label": "Things to sort" });
      const cheer = el("p", { class: "cheer", "aria-live": "polite" });

      function pick(chip) {
        $$(".chip", pool).forEach((c) => c.classList.remove("selected"));
        selected = chip;
        chip.classList.add("selected");
        sfx.pop();
        bins.forEach((b) => b.node.classList.add("armed"));
      }

      items.forEach((it) => {
        const chip = el("button", { class: "chip", type: "button", html: iconSVG(it.icon) + it.name });
        chip.dataset.kind = it.kind;
        chip.addEventListener("click", () => pick(chip));
        pool.appendChild(chip);
      });

      const bins = [
        { kind: "need", title: "NEEDS", sub: "must-haves", color: "var(--save)", soft: "var(--save-soft)" },
        { kind: "want", title: "WANTS", sub: "nice-to-haves", color: "var(--spend)", soft: "var(--spend-soft)" },
      ].map((b) => {
        const node = el("div", { class: "bin", role: "button", tabindex: "0", "aria-label": b.title + " basket" });
        node.style.setProperty("--bin-color", b.color);
        node.style.setProperty("--bin-soft", b.soft);
        node.innerHTML = "<h3>" + b.title + "<br><small>" + b.sub + "</small></h3><div class=\"bin-items\"></div>";
        function drop() {
          if (!selected) return;
          if (selected.dataset.kind === b.kind) {
            selected.classList.remove("selected");
            selected.disabled = true;
            $(".bin-items", node).appendChild(selected);
            selected = null;
            placed++;
            sfx.coin();
            cheer.classList.remove("oops");
            cheer.textContent = placed === items.length ? "All sorted — you are a Needs & Wants champ!" : "Great sorting! " + (items.length - placed) + " to go";
            if (placed === items.length) onDone();
          } else {
            cheer.classList.add("oops");
            cheer.textContent = "Hmm, try the other basket! Think: can you live without it?";
            sfx.oops();
            selected.classList.add("shake");
            const s = selected;
            setTimeout(() => s.classList.remove("shake"), 450);
          }
          bins.forEach((x) => x.node.classList.remove("armed"));
        }
        node.addEventListener("click", drop);
        node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drop(); } });
        return { ...b, node };
      });

      const binWrap = el("div", { class: "bins" });
      bins.forEach((b) => binWrap.appendChild(b.node));
      wrap.appendChild(pool);
      wrap.appendChild(binWrap);
      wrap.appendChild(cheer);
      return wrap;
    },

    chores(onDone) {
      const jobs = [
        { name: "Walk the dog", pay: 2, icon: "heart" },
        { name: "Sweep the floor", pay: 1, icon: "work" },
        { name: "Water the plants", pay: 1, icon: "plant" },
        { name: "Set the table", pay: 1, icon: "jars" },
        { name: "Wash the car", pay: 3, icon: "shop" },
        { name: "Tidy the books", pay: 2, icon: "chart" },
      ];
      let earned = 0;
      let doneCount = 0;
      const wrap = el("div");
      wrap.appendChild(el("p", { class: "hint", text: "Tap each chore to do it and watch your piggy bank grow!" }));
      const board = el("div", { class: "chores" });
      const total = el("div", { class: "piggy-total", html: "You earned: <span class=\"amount\">$0</span>" });
      const cheer = el("p", { class: "cheer", "aria-live": "polite" });
      jobs.forEach((j) => {
        const btn = el("button", { class: "chore", type: "button", html: iconSVG(j.icon) + j.name + "<span class=\"chore-pay\">+$" + j.pay + "</span>" });
        btn.addEventListener("click", () => {
          if (btn.classList.contains("done")) return;
          btn.classList.add("done");
          btn.disabled = true;
          earned += j.pay;
          doneCount++;
          sfx.coin();
          $(".amount", total).textContent = "$" + earned;
          total.classList.remove("bump");
          void total.offsetWidth;
          total.classList.add("bump");
          cheer.textContent = doneCount === jobs.length ? "WOW — you earned $" + earned + " all by yourself!" : "Ka-ching! +$" + j.pay;
          if (doneCount === jobs.length) onDone();
        });
        board.appendChild(btn);
      });
      wrap.appendChild(board);
      wrap.appendChild(total);
      wrap.appendChild(cheer);
      return wrap;
    },

    jars(onDone) {
      const TOTAL = 10;
      let selected = null;
      const counts = { save: 0, spend: 0, share: 0 };
      const wrap = el("div");
      wrap.appendChild(el("p", { class: "hint", html: "You earned <strong>10 coins</strong>! Tap a coin, then tap a jar. YOU decide the split!" }));
      wrap.appendChild(el("div", { class: "color-legend", style: "position:static;margin:0 auto 10px;", html: "<span class=\"l-save\">Save</span> · <span class=\"l-spend\">Spend</span> · <span class=\"l-share\">Share</span>" }));
      const pool = el("div", { class: "sorter-pool", "aria-label": "Your coins" });
      const cheer = el("p", { class: "cheer", "aria-live": "polite" });
      for (let i = 0; i < TOTAL; i++) {
        const coin = el("button", { class: "coin", type: "button", html: "$1", "aria-label": "One dollar coin" });
        coin.addEventListener("click", () => {
          $$(".coin", pool).forEach((c) => c.classList.remove("selected"));
          selected = coin;
          coin.classList.add("selected");
          sfx.pop();
          jarNodes.forEach((j) => j.node.classList.add("armed"));
        });
        pool.appendChild(coin);
      }
      const jarNodes = [
        { key: "save", title: "SAVE", color: "var(--save)" },
        { key: "spend", title: "SPEND", color: "var(--spend)" },
        { key: "share", title: "SHARE", color: "#c98f00" },
      ].map((j) => {
        const node = el("div", { class: "money-jar", role: "button", tabindex: "0", "aria-label": j.title + " jar" });
        node.style.setProperty("--jar-color", j.color);
        node.style.setProperty("--bin-color", j.color);
        node.innerHTML = "<h3>" + j.title + "</h3><div class=\"jar-glass-big\"><div class=\"jar-coins\"></div></div><div class=\"jar-count\">0 coins</div>";
        function drop() {
          if (!selected) return;
          selected.remove();
          selected = null;
          counts[j.key]++;
          sfx.coin();
          $(".jar-coins", node).style.height = counts[j.key] * 10 + "%";
          $(".jar-count", node).textContent = counts[j.key] + (counts[j.key] === 1 ? " coin" : " coins");
          jarNodes.forEach((x) => x.node.classList.remove("armed"));
          const placed = counts.save + counts.spend + counts.share;
          if (placed === TOTAL) {
            let msg = "All 10 coins have a home! ";
            if (counts.save === 0) msg += "Next time, try feeding the green SAVE jar too — future you will cheer!";
            else if (counts.share === 0) msg += "You are saving like a pro! Maybe share a coin next time too.";
            else msg += "Saving AND sharing — Penny is so proud!";
            cheer.textContent = msg;
            onDone();
          } else {
            cheer.textContent = (TOTAL - placed) + " coins left to place";
          }
        }
        node.addEventListener("click", drop);
        node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); drop(); } });
        return { ...j, node };
      });
      const row = el("div", { class: "jars-row" });
      jarNodes.forEach((j) => row.appendChild(j.node));
      wrap.appendChild(pool);
      wrap.appendChild(row);
      wrap.appendChild(cheer);
      return wrap;
    },

    budget(onDone) {
      const ALLOWANCE = 10;
      const rows = [
        { key: "snacks", name: "Snacks", color: "var(--spend)" },
        { key: "toys", name: "Toys & fun", color: "var(--spend)" },
        { key: "gifts", name: "Sharing", color: "#c98f00" },
        { key: "savings", name: "Savings", color: "var(--save)" },
      ];
      const vals = { snacks: 0, toys: 0, gifts: 0, savings: 0 };
      let finished = false;
      const wrap = el("div");
      wrap.appendChild(el("p", { class: "hint", html: "Slide each bar until <strong>all $10 has a job</strong>. Tip: give Savings at least $1!" }));
      const rowsWrap = el("div", { class: "budget-rows" });
      const meter = el("div", { class: "budget-meter", "aria-live": "polite" });
      const cheer = el("p", { class: "cheer", "aria-live": "polite" });
      function refresh() {
        const total = rows.reduce((s, r) => s + vals[r.key], 0);
        const left = ALLOWANCE - total;
        meter.classList.remove("good", "over");
        if (left > 0) meter.textContent = "$" + left + " still needs a job!";
        else if (left < 0) { meter.classList.add("over"); meter.textContent = "Oops — that is $" + (-left) + " more than you have!"; }
        else {
          meter.classList.add("good");
          meter.textContent = "Perfect! Every dollar has a job!";
          if (vals.savings >= 1) {
            if (!finished) { finished = true; cheer.textContent = "A balanced budget WITH savings — that is money-boss level!"; onDone(); }
          } else cheer.textContent = "Almost! Slide at least $1 into Savings.";
        }
      }
      rows.forEach((r) => {
        const row = el("div", { class: "budget-row" });
        row.style.setProperty("--row-color", r.color);
        const label = el("span", { class: "b-label", text: r.name });
        const slider = el("input", { type: "range", min: "0", max: "10", value: "0", step: "1", "aria-label": r.name + " dollars" });
        const val = el("span", { class: "b-val", text: "$0" });
        const bar = el("div", { class: "icon-bar", "aria-hidden": "true" });
        slider.addEventListener("input", () => {
          vals[r.key] = Number(slider.value);
          val.textContent = "$" + slider.value;
          bar.textContent = "●".repeat(vals[r.key]);
          bar.style.color = r.color;
          refresh();
        });
        row.appendChild(label); row.appendChild(slider); row.appendChild(val); row.appendChild(bar);
        rowsWrap.appendChild(row);
      });
      refresh();
      wrap.appendChild(rowsWrap);
      wrap.appendChild(meter);
      wrap.appendChild(cheer);
      return wrap;
    },

    garden(onDone) {
      const START = 10;
      const RATE = 0.1;
      let touched = false;
      const wrap = el("div");
      wrap.appendChild(el("p", { class: "hint", html: "You put <strong>$10</strong> in the bank. Slide time forward and watch your money garden grow!" }));
      const garden = el("div", { class: "garden" });
      const plantHost = el("div");
      const stack = el("div", { class: "coin-stack", "aria-hidden": "true" });
      garden.appendChild(plantHost);
      garden.appendChild(stack);
      const readout = el("p", { class: "garden-readout", "aria-live": "polite" });
      const slider = el("input", { class: "year-slider", type: "range", min: "0", max: "10", value: "0", step: "1", "aria-label": "Years of saving" });
      const labels = el("div", { class: "year-labels", html: "<span>Now</span><span>5 years</span><span>10 years</span>" });
      const cheer = el("p", { class: "cheer", "aria-live": "polite" });
      function refresh() {
        const years = Number(slider.value);
        const amount = Math.round(START * Math.pow(1 + RATE, years));
        plantHost.innerHTML = plantSVG(years);
        const coins = Math.min(amount, 26);
        stack.innerHTML = "<div class=\"stack-coin\"></div>".repeat(coins);
        readout.innerHTML = "After <strong>" + years + (years === 1 ? " year" : " years") + "</strong>: <span class=\"grow-amt\">$" + amount + "</span>" +
          (years > 0 ? " — the bank added <strong>$" + (amount - START) + "</strong> for free!" : " — your seed is planted.");
        if (years >= 8 && !touched) {
          touched = true;
          cheer.innerHTML = "Your $10 more than doubled without any work. That is the magic of interest! Pssst — the <a href=\"#/bank\">Penny Bank</a> does this with YOUR coins.";
          onDone();
        } else if (!touched && years > 0) {
          cheer.textContent = "Keep sliding to 8 years or more…";
        }
      }
      slider.addEventListener("input", refresh);
      refresh();
      wrap.appendChild(garden);
      wrap.appendChild(readout);
      wrap.appendChild(slider);
      wrap.appendChild(labels);
      wrap.appendChild(cheer);
      return wrap;
    },

    goal(onDone) {
      const WEEKLY = 4;
      const goals = [
        { name: "Art set", price: 12, icon: "star" },
        { name: "Skateboard", price: 20, icon: "goal" },
        { name: "Robot kit", price: 32, icon: "work" },
      ];
      let picked = null, saved = 0, weeks = 0, finished = false;
      const wrap = el("div");
      wrap.appendChild(el("p", { class: "hint", html: "Step 1: pick your dream. Step 2: save <strong>$4 every week</strong> until you reach it!" }));
      const choices = el("div", { class: "goal-choices" });
      const track = el("div", { class: "goal-track", "aria-hidden": "true" });
      const fill = el("div", { class: "goal-fill" });
      track.appendChild(fill);
      const status = el("p", { class: "garden-readout", "aria-live": "polite" });
      const saveBtn = el("button", { class: "big-btn green", type: "button", text: "Save this week’s $4" });
      saveBtn.disabled = true;
      const cheer = el("p", { class: "cheer", "aria-live": "polite" });
      goals.forEach((g) => {
        const card = el("button", { class: "goal-card", type: "button", html: iconSVG(g.icon) + g.name + "<br><span class=\"goal-price\">$" + g.price + "</span>" });
        card.addEventListener("click", () => {
          if (finished) return;
          $$(".goal-card", choices).forEach((c) => c.classList.remove("picked"));
          card.classList.add("picked");
          sfx.pop();
          picked = g; saved = 0; weeks = 0;
          saveBtn.disabled = false;
          fill.style.width = "0%";
          fill.textContent = "";
          status.innerHTML = "Goal: <strong>" + g.name + " ($" + g.price + ")</strong>. That is about " + Math.ceil(g.price / WEEKLY) + " weeks of saving. You got this!";
          cheer.textContent = "";
        });
        choices.appendChild(card);
      });
      saveBtn.addEventListener("click", () => {
        if (!picked || finished) return;
        saved = Math.min(saved + WEEKLY, picked.price);
        weeks++;
        sfx.coin();
        const pct = Math.round((saved / picked.price) * 100);
        fill.style.width = pct + "%";
        fill.textContent = "$" + saved;
        if (saved >= picked.price) {
          finished = true;
          saveBtn.disabled = true;
          status.innerHTML = "<span class=\"grow-amt\">GOAL REACHED in " + weeks + " weeks!</span> Enjoy your " + picked.name + " — you earned it!";
          cheer.textContent = "That waiting superpower is called patience — and it just paid off!";
          confetti();
          sfx.win();
          onDone();
        } else {
          status.innerHTML = "Week " + weeks + ": you saved <strong>$" + saved + "</strong> of $" + picked.price + ". Keep going!";
        }
      });
      wrap.appendChild(choices);
      wrap.appendChild(track);
      wrap.appendChild(status);
      wrap.appendChild(el("p", { style: "text-align:center;margin-top:10px;" }, [saveBtn]));
      wrap.appendChild(cheer);
      return wrap;
    },

    lemonade(onDone) {
      const COST = 0.2;
      const options = [
        { price: 0.25, cups: 40 },
        { price: 0.5, cups: 30 },
        { price: 1.0, cups: 18 },
        { price: 2.0, cups: 5 },
      ];
      const tried = new Set();
      let doneFired = false;
      const wrap = el("div");
      wrap.appendChild(el("p", { class: "hint", html: "Each cup costs you <strong>20¢</strong> to make. Try at least <strong>two prices</strong> and find the best profit!" }));
      const grid = el("div", { class: "lemonade-grid" });
      const btns = el("div", { class: "price-btns" });
      const report = el("div", { class: "stand-report", "aria-live": "polite" });
      report.innerHTML = "<p style=\"text-align:center;font-weight:700;\">Pick a price to open your stand!</p>";
      const cheer = el("p", { class: "cheer", "aria-live": "polite" });
      const money = (n) => "$" + n.toFixed(2);
      options.forEach((o) => {
        const b = el("button", { class: "price-btn", type: "button", text: money(o.price) + " per cup" });
        b.addEventListener("click", () => {
          $$(".price-btn", btns).forEach((x) => x.classList.remove("picked"));
          b.classList.add("picked");
          sfx.pop();
          tried.add(o.price);
          const income = o.price * o.cups;
          const costs = COST * o.cups;
          const profit = income - costs;
          report.innerHTML =
            "<div class=\"cup-row\" role=\"img\" aria-label=\"" + o.cups + " cups sold\">" + "●".repeat(o.cups) + "</div>" +
            "<div class=\"report-line\"><span>Cups sold</span><span>" + o.cups + "</span></div>" +
            "<div class=\"report-line\"><span>Money in</span><span class=\"pos\">+" + money(income) + "</span></div>" +
            "<div class=\"report-line\"><span>Costs</span><span class=\"neg\">−" + money(costs) + "</span></div>" +
            "<div class=\"report-line profit\"><span>PROFIT</span><span class=\"pos\">" + money(profit) + "</span></div>";
          if (tried.size >= 2 && !doneFired) {
            doneFired = true;
            cheer.textContent = "You compared prices like a real business boss! Which one made the most profit?";
            onDone();
          } else if (!doneFired) {
            cheer.textContent = "Interesting! Now try a different price to compare.";
          }
        });
        btns.appendChild(b);
      });
      grid.appendChild(btns);
      grid.appendChild(report);
      wrap.appendChild(grid);
      wrap.appendChild(cheer);
      return wrap;
    },

    safety(onDone) {
      const cards = [
        { text: "Ask a grown-up before buying in a game", ok: true, why: "Smart move! Always check first." },
        { text: "Share your password with a game friend", ok: false, why: "Never! Passwords are secret keys." },
        { text: "\"FREE coins! Just enter your card number!\"", ok: false, why: "Trick alert! Free-stuff pop-ups steal money." },
        { text: "Feels weird? Stop and tell a trusted adult", ok: true, why: "Exactly right — that is your safety shield!" },
        { text: "Click links from strangers about prizes", ok: false, why: "Nope! Strangers with prizes = scam." },
        { text: "Only shop online together with your family", ok: true, why: "Yes! Shopping is a team sport." },
      ];
      let flipped = 0;
      const wrap = el("div");
      wrap.appendChild(el("p", { class: "hint", text: "Read each card and guess: smart move or danger zone? Tap to flip and find out!" }));
      const grid = el("div", { class: "flip-grid" });
      const cheer = el("p", { class: "cheer", "aria-live": "polite" });
      cards.forEach((c) => {
        const card = el("button", { class: "flip-card", type: "button", "aria-label": c.text + " — tap to reveal answer" });
        const inner = el("div", { class: "flip-inner" });
        inner.appendChild(el("div", { class: "flip-face flip-front", text: c.text }));
        inner.appendChild(el("div", { class: "flip-face flip-back " + (c.ok ? "ok" : "no"), text: (c.ok ? "Smart move. " : "Danger zone. ") + c.why }));
        card.appendChild(inner);
        card.addEventListener("click", () => {
          if (card.classList.contains("flipped")) return;
          card.classList.add("flipped");
          flipped++;
          if (c.ok) sfx.pop(); else sfx.oops();
          cheer.textContent = flipped === cards.length ? "Shield complete — you are a digital money guardian!" : flipped + " of " + cards.length + " flipped";
          if (flipped === cards.length) onDone();
        });
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
      wrap.appendChild(cheer);
      return wrap;
    },
  };


  /* ================================================================
     VIEWS
     ================================================================ */
  function lessonState(mod, index) {
    const done = state.badges.includes(mod.id);
    const firstOpen = MODULES.findIndex((m) => !state.badges.includes(m.id));
    if (done) return "done";
    if (firstOpen === -1 || firstOpen === index) return "open";
    return "locked";
  }

  function buildDailyChallenge() {
    const today = new Date().toDateString();
    const wrap = el("section", { class: "daily-board", "aria-label": "Daily challenge" });
    function doneState(msg) {
      wrap.className = "daily-board done";
      wrap.innerHTML = "<div class=\"daily-head\">Daily Challenge</div><p class=\"daily-done\">" + msg + "<br><small>Come back tomorrow for a new one!</small></p>";
    }
    if (state.lastChallenge === today) {
      doneState("Done for today — nice brain work!");
      return wrap;
    }
    let h = 0;
    for (let i = 0; i < today.length; i++) h = (h * 31 + today.charCodeAt(i)) | 0;
    const q = QUEST_POOL[Math.abs(h) % QUEST_POOL.length];
    wrap.innerHTML = "<div class=\"daily-head\">Daily Challenge <span class=\"daily-reward\">+3</span></div><p class=\"daily-q\">" + q.q + "</p>";
    const answers = el("div", { class: "daily-answers" });
    const shuffled = q.a.slice().sort(() => Math.random() - 0.5);
    let answered = false;
    shuffled.forEach((ans) => {
      const btn = el("button", { class: "daily-answer", type: "button", text: ans[0] });
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        state.lastChallenge = today;
        $$(".daily-answer", answers).forEach((x) => { x.disabled = true; });
        if (ans[1]) {
          btn.classList.add("right");
          awardCoins(3, btn);
          sfx.win();
          save();
          setTimeout(() => doneState("Correct! +3 coins"), 950);
        } else {
          btn.classList.add("wrong");
          shuffled.forEach((a, i) => { if (a[1]) answers.children[i].classList.add("right"); });
          sfx.oops();
          save();
          setTimeout(() => doneState("Good try! You remembered a little more today."), 1500);
        }
      });
      answers.appendChild(btn);
    });
    wrap.appendChild(answers);
    return wrap;
  }

  function renderWelcome(app) {
    let step = 0;
    let avatar = state.avatar || "🦊";
    function draw() {
      app.innerHTML = "";
      const stage = el("section", { class: "welcome-stage" });
      const card = el("div", { class: "welcome-card" });
      if (step === 0) {
        card.appendChild(speechRow("Hi! I’m <strong>Penny</strong>. I keep a whole town of money secrets — jars that grow, a shop of hats, and a castle at the end of the path. Want to walk it with me?", { size: 150, expr: "talk" }));
        const next = el("button", { class: "big-btn gold", type: "button", text: "Yes — let’s go!" });
        next.addEventListener("click", () => { sfx.pop(); step = 1; draw(); });
        card.appendChild(el("p", { style: "text-align:center;margin-top:12px;" }, [next]));
      } else if (step === 1) {
        card.appendChild(speechRow("What should I call you, adventurer?", { size: 130, expr: "idle" }));
        const input = el("input", { class: "name-input", type: "text", maxlength: "16", placeholder: "Your name (or a nickname!)", "aria-label": "Your name" });
        input.value = state.name || "";
        const next = el("button", { class: "big-btn", type: "button", text: "That’s me!" });
        next.addEventListener("click", () => {
          state.name = input.value.trim().slice(0, 16);
          sfx.pop();
          step = 2;
          draw();
        });
        card.appendChild(input);
        card.appendChild(el("p", { style: "text-align:center;margin-top:14px;" }, [next]));
        setTimeout(() => input.focus(), 50);
      } else {
        card.appendChild(speechRow("Pick a buddy to walk the path with us.", { size: 120, expr: "cheer" }));
        const avRow = el("div", { class: "avatar-row", role: "radiogroup", "aria-label": "Pick your animal buddy" });
        BUDDIES.forEach((a, i) => {
          const b = el("button", {
            class: "avatar-btn" + (a === avatar ? " picked" : ""),
            type: "button", text: a, role: "radio",
            "aria-checked": a === avatar ? "true" : "false",
            "aria-label": "buddy " + (i + 1),
          });
          b.addEventListener("click", () => {
            avatar = a;
            $$(".avatar-btn", avRow).forEach((x) => { x.classList.remove("picked"); x.setAttribute("aria-checked", "false"); });
            b.classList.add("picked");
            b.setAttribute("aria-checked", "true");
            sfx.pop();
          });
          avRow.appendChild(b);
        });
        const start = el("button", { class: "big-btn gold", type: "button", text: "Light up the first landmark!" });
        start.addEventListener("click", () => {
          state.avatar = avatar;
          state.welcomed = true;
          state.lastAllowance = new Date().toDateString();
          save();
          confetti();
          sfx.big();
          render();
        });
        card.appendChild(el("p", { class: "avatar-label", text: "Pick your adventure buddy:" }));
        card.appendChild(avRow);
        card.appendChild(el("p", { style: "text-align:center;margin-top:14px;" }, [start]));
      }
      stage.appendChild(card);
      app.appendChild(stage);
    }
    draw();
  }

  function renderHome(app) {
    if (!state.welcomed) { renderWelcome(app); return; }

    const today = new Date().toDateString();
    let gotAllowance = false;
    if (state.lastAllowance !== today) {
      state.lastAllowance = today;
      state.coins += 5;
      state.totalEarned += 5;
      save();
      updateWallet(true);
      sfx.coin();
      gotAllowance = true;
    }

    if (gotAllowance) {
      app.appendChild(el("div", { class: "allowance-banner", html: "Daily allowance: <strong>+5 coins</strong> for coming back today!" }));
    }

    const world = el("section", { class: "town-world", "aria-label": "Penny Town winding adventure path" });
    const canvas = el("div", { class: "town-canvas" });
    canvas.innerHTML = townBackdrop();

    canvas.appendChild(el("div", {
      class: "color-legend",
      html: "Money colors: <span class=\"l-save\">Save</span> · <span class=\"l-spend\">Spend</span> · <span class=\"l-share\">Share</span>",
    }));

    const buildings = el("div", { class: "town-buildings", "aria-label": "Town buildings" });
    const questOpen = state.badges.length === MODULES.length;
    const places = [
      { href: "#/kindness", cls: "kindness", title: "Kindness Corner", tag: "Give — just because", icon: "heart", locked: false },
      { href: "#/bank", cls: "bank", title: "Penny Bank", tag: "Grows 1% every hour", icon: "bank", locked: false },
      { href: "#/shop", cls: "shop", title: "Penny Shop", tag: "Dress up Penny", icon: "shop", locked: false },
      { href: "#/quest", cls: "quest" + (questOpen ? "" : " locked"), title: "Quest Castle", tag: questOpen ? (state.questDone ? "Conquered!" : "The final challenge") : "Earn all 9 badges", icon: "castle", locked: !questOpen },
    ];
    places.forEach((p) => {
      const a = el("a", { class: "building " + p.cls, href: p.href });
      const btn = el("span", { class: "building-btn", html: iconSVG(p.icon) + (p.locked ? iconSVG("lock") : "") });
      a.appendChild(btn);
      a.appendChild(el("span", { class: "building-title", text: p.title }));
      a.appendChild(el("span", { class: "landmark-tag", text: p.tag }));
      buildings.appendChild(a);
    });

    const hello = el("div", { class: "town-hello speech-bubble" });
    const helloCopy = el("p", { class: "town-hello-copy" });
    helloCopy.append("Hi ", el("strong", { text: kidName() }), " " + state.avatar + "! Follow the glowing path. Every landmark pays Penny Coins you can bank, grow, or spend in my shop.");
    hello.appendChild(helloCopy);
    canvas.appendChild(hello);

    const trail = el("ol", { class: "trail", "aria-label": "Nine lesson landmarks on the path" });
    MODULES.forEach((m, i) => {
      const st = lessonState(m, i);
      const a = el("a", {
        class: "landmark " + st + (i % 2 ? " label-up" : " label-down"),
        href: "#/module/" + m.id,
        style: "left:" + m.pos.x + "%;top:" + m.pos.y + "%;",
        "aria-label": (i + 1) + ". " + m.title,
      });
      const btn = el("span", { class: "landmark-btn" });
      btn.innerHTML = "<span class=\"landmark-num\">" + (i + 1) + "</span>" + iconSVG(m.icon) +
        (st === "done" ? "<span class=\"landmark-star\" aria-label=\"completed\">" + iconSVG("star") + "</span>" : "") +
        (st === "locked" ? "<span class=\"landmark-lock\" aria-hidden=\"true\">" + iconSVG("lock") + "</span>" : "");
      a.appendChild(btn);
      const copy = el("span", { class: "landmark-copy" });
      copy.appendChild(el("span", { class: "landmark-title", text: m.title }));
      copy.appendChild(el("span", { class: "landmark-tag", text: st === "done" ? "Replay +2 coins" : "+10 coins first play" }));
      a.appendChild(copy);
      trail.appendChild(el("li", {}, [a]));
    });
    canvas.appendChild(trail);

    const pennyBox = el("div", { class: "town-penny" });
    pennyBox.appendChild(pennyEl(110, "idle"));
    canvas.appendChild(pennyBox);

    world.appendChild(canvas);
    app.appendChild(world);
    app.appendChild(buildings);
    app.appendChild(buildDailyChallenge());

    const readRow = el("p", { style: "text-align:center;margin-top:14px;" });
    readRow.appendChild(readBtn(() => "Hi there! Follow the glowing path. Every landmark pays Penny Coins you can bank, grow, or spend in my shop!"));
    app.appendChild(readRow);
  }

  function renderModule(app, mod) {
    let step = 0;
    const stepNames = ["Watch", "Play", "Think", "Collect"];
    function draw() {
      app.innerHTML = "";
      const room = el("section", { class: "room room-lesson" });
      room.style.setProperty("--node-color", mod.color);
      const head = el("div", { class: "lesson-head" });
      head.appendChild(el("p", { class: "crumbs", html: "<a href=\"#/\">Back to the path</a>" }));
      const dots = el("div", { class: "steps-dots", "aria-label": "Step " + (step + 1) + " of 4: " + stepNames[step] });
      stepNames.forEach((n, i) => dots.appendChild(el("span", { class: "step-chip" + (i === step ? " on" : ""), text: n })));
      head.appendChild(dots);
      room.appendChild(head);

      const card = el("section", { class: "lesson-card" });
      card.appendChild(el("h1", { text: mod.title }));
      card.appendChild(speechRow(mod.bubble, { size: 88, expr: step === 2 ? "think" : step === 3 ? "cheer" : "talk" }));

      let bodyText = mod.bubble;
      const next = el("button", { class: "big-btn", type: "button" });

      if (step === 0) {
        const row = el("div", { class: "panel-row" });
        mod.intro.forEach((p) => {
          row.appendChild(el("div", { class: "story-panel", html: "<div class=\"story-art\">" + iconSVG(p.icon) + "</div><p class=\"story-text\">" + p.text + "</p>" }));
        });
        card.appendChild(row);
        bodyText += " " + mod.intro.map((p) => p.text).join(" ");
        next.textContent = "Let’s play!";
        next.addEventListener("click", () => { step = 1; draw(); });
      } else if (step === 1) {
        next.textContent = "Think about it!";
        next.disabled = true;
        const firstClear = !state.activityCleared[mod.id];
        const activity = ACTIVITIES[mod.activity](() => {
          next.disabled = false;
          next.classList.add("green");
          const amt = firstClear ? 10 : 2;
          state.activityCleared[mod.id] = true;
          awardCoins(amt, next);
          card.appendChild(el("p", { class: "badge-earned", text: "+" + amt + " Penny Coins!" }));
        });
        card.appendChild(activity);
        next.addEventListener("click", () => { step = 2; draw(); });
      } else if (step === 2) {
        const r = REFLECT[mod.id];
        next.textContent = "Collect my stickers!";
        next.disabled = true;
        card.appendChild(el("h2", { text: "Your turn to think" }));
        card.appendChild(el("p", { class: "reflect-q", text: r.q }));
        const choicesWrap = el("div", { class: "reflect-choices" });
        const resp = el("p", { class: "cheer reflect-resp", "aria-live": "polite" });
        r.choices.forEach((c) => {
          const btn = el("button", { class: "reflect-choice", type: "button", text: c[0] });
          btn.addEventListener("click", () => {
            $$(".reflect-choice", choicesWrap).forEach((x) => { x.disabled = true; x.classList.remove("chosen"); });
            btn.classList.add("chosen");
            resp.textContent = c[1];
            sfx.pop();
            next.disabled = false;
            next.classList.add("green");
          });
          choicesWrap.appendChild(btn);
        });
        card.appendChild(choicesWrap);
        card.appendChild(resp);
        bodyText = r.q;
        next.addEventListener("click", () => { step = 3; draw(); });
      } else {
        card.appendChild(el("h2", { text: "You learned…" }));
        const row = el("div", { class: "sticker-row" });
        mod.recap.forEach((r) => {
          row.appendChild(el("div", { class: "sticker", html: "<div class=\"story-art\">" + iconSVG(r.icon) + "</div><p>" + r.text + "</p>" }));
        });
        card.appendChild(row);
        bodyText = "You learned: " + mod.recap.map((r) => r.text).join(" ");
        const already = state.badges.includes(mod.id);
        next.classList.add("gold");
        next.textContent = already ? "Badge collected! Back to the path" : "Collect my badge!";
        next.addEventListener("click", () => {
          if (!state.badges.includes(mod.id)) {
            markComplete(mod.id);
            awardCoins(5, next);
            confetti();
            sfx.big();
            next.textContent = "Back to the path";
            const allDone = state.badges.length === MODULES.length;
            card.appendChild(el("p", {
              class: "badge-earned",
              html: "New badge + 5 coins!" + (allDone ? " All 9 badges! The <a href=\"#/quest\">Money Master Quest</a> is now open!" : ""),
            }));
            next.onclick = () => { location.hash = "#/"; };
          } else {
            location.hash = "#/";
          }
        });
      }

      const foot = el("div", { class: "lesson-foot" });
      foot.appendChild(readBtn(() => bodyText.replace(/<[^>]+>/g, "")));
      foot.appendChild(next);
      card.appendChild(foot);
      room.appendChild(card);
      app.appendChild(room);
      app.focus();
    }
    draw();
  }


  function renderBank(app) {
    accrueBank();
    const gained = state.unseenInterest;
    state.unseenInterest = 0;
    save();

    const room = el("section", { class: "room room-bank" });
    room.appendChild(el("div", { class: "room-deco", html: "<div class=\"vault-door\" aria-hidden=\"true\"></div>" }));
    room.appendChild(el("p", { class: "crumbs", html: "<a href=\"#/\">Back to the path</a>" }));
    room.appendChild(el("h1", { text: "Penny Bank" }));
    room.appendChild(speechRow("Welcome to my bank, " + escapeHtml(kidName()) + "! Coins you keep here earn <strong>1% interest every hour</strong> — even while you sleep. Come back tomorrow and see the magic.", { expr: "talk", size: 100 }));

    if (gained >= 1) {
      room.appendChild(el("div", { class: "allowance-banner grow-banner", html: "While you were away, your savings grew by <strong>+" + Math.floor(gained) + " coins</strong> — that is interest!" }));
      sfx.win();
    }

    const card = el("section", { class: "lesson-card bank-card" });
    const balances = el("div", { class: "bank-balances" });
    balances.appendChild(el("div", { class: "balance-box wallet-box", html: "<h3>Wallet</h3><p class=\"balance-num\" id=\"bWallet\">" + Math.floor(state.coins) + "</p><p class=\"balance-sub\">coins ready to use</p>" }));
    balances.appendChild(el("div", { class: "balance-box bank-box", html: "<h3>In the bank</h3><p class=\"balance-num\" id=\"bBank\">" + Math.floor(state.bank.balance) + "</p><p class=\"balance-sub\" id=\"bGrow\">growing every hour…</p>" }));
    card.appendChild(balances);
    const btnRow = el("div", { class: "bank-btns" });
    const cheer = el("p", { class: "cheer", "aria-live": "polite" });

    function refresh() {
      const w = $("#bWallet"); const b = $("#bBank"); const g = $("#bGrow");
      if (w) w.textContent = Math.floor(state.coins);
      if (b) b.textContent = Math.floor(state.bank.balance);
      updateWallet();
      const bal = state.bank.balance;
      const day = bal * Math.pow(1 + HOURLY_RATE, 24) - bal;
      const week = bal * Math.pow(1 + HOURLY_RATE, 24 * 7) - bal;
      if (g) g.innerHTML = bal >= 1
        ? "by tomorrow: <strong>+" + Math.max(1, Math.floor(day)) + "</strong> · in a week: <strong>+" + Math.floor(week) + "</strong>"
        : "deposit coins to start growing!";
    }

    function move(kind, amount) {
      accrueBank();
      if (kind === "in") {
        const amt = Math.min(amount === "all" ? Math.floor(state.coins) : amount, Math.floor(state.coins));
        if (amt <= 0) { cheer.classList.add("oops"); cheer.textContent = "Your wallet is empty — play a lesson to earn coins!"; sfx.oops(); return; }
        state.coins -= amt;
        state.bank.balance += amt;
        cheer.classList.remove("oops");
        cheer.textContent = "Deposited " + amt + " coins — watch them grow!";
        sfx.coin();
      } else {
        const avail = Math.floor(state.bank.balance);
        const amt = Math.floor(Math.min(amount === "all" ? avail : amount, avail));
        if (amt <= 0) { cheer.classList.add("oops"); cheer.textContent = "Nothing in the bank yet!"; sfx.oops(); return; }
        state.bank.balance = Math.floor(state.bank.balance - amt);
        state.coins += amt;
        cheer.classList.remove("oops");
        cheer.textContent = "Withdrew " + amt + " coins to your wallet";
        sfx.coin();
      }
      save();
      refresh();
    }

    [
      { label: "Put in 10", fn: () => move("in", 10), cls: "green" },
      { label: "Put in ALL", fn: () => move("in", "all"), cls: "green" },
      { label: "Take out 10", fn: () => move("out", 10), cls: "ghost" },
      { label: "Take out ALL", fn: () => move("out", "all"), cls: "ghost" },
    ].forEach((b) => btnRow.appendChild(el("button", { class: "big-btn " + b.cls, type: "button", text: b.label, onclick: b.fn })));
    card.appendChild(btnRow);
    card.appendChild(cheer);
    card.appendChild(el("div", { class: "hint", html: "<strong>Why does the bank pay you?</strong> Real banks pay interest too (a little slower!). Money you do not spend today quietly earns more money. Total interest earned here: <strong>" + Math.floor(state.bankEarned) + " coins</strong>." }));
    room.appendChild(card);
    app.appendChild(room);
    refresh();
    window.__tick = setInterval(() => { accrueBank(); refresh(); }, 5000);
  }

  function shopThumb(item) {
    return `<svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true"><rect width="80" height="80" rx="16" fill="#fff6e4"/>${accSVG(item.id)}</svg>`;
  }

  function renderShop(app) {
    const room = el("section", { class: "room room-shop" });
    room.appendChild(el("p", { class: "crumbs", html: "<a href=\"#/\">Back to the path</a>" }));
    room.appendChild(el("h1", { text: "Penny Shop" }));
    room.appendChild(speechRow("Spend your hard-earned coins to dress me up! The fancy stuff costs more — a perfect <strong>savings goal</strong>. I wear what you pick everywhere!", { expr: "cheer", size: 100 }));

    const preview = el("div", { class: "shop-preview" });
    preview.appendChild(pennyEl(180, "idle"));
    room.appendChild(preview);

    const cheer = el("p", { class: "cheer", "aria-live": "polite" });
    const grid = el("div", { class: "shop-grid" });

    function draw() {
      grid.innerHTML = "";
      SHOP.forEach((item) => {
        const owned = state.owned.includes(item.id);
        const equipped = state.equipped[item.slot] === item.id;
        const canAfford = Math.floor(state.coins) >= item.price;
        const card = el("div", { class: "shop-card" + (equipped ? " equipped" : "") });
        card.innerHTML = shopThumb(item) + "<h3>" + item.name + "</h3><p class=\"shop-price\">" + (owned ? "Yours!" : item.price + " coins") + "</p>";
        const btn = el("button", { class: "big-btn " + (owned ? (equipped ? "ghost" : "gold") : canAfford ? "green" : "ghost"), type: "button" });
        if (owned) {
          btn.textContent = equipped ? "Take off" : "Wear it!";
          btn.addEventListener("click", () => {
            if (equipped) delete state.equipped[item.slot];
            else state.equipped[item.slot] = item.id;
            save();
            sfx.pop();
            refreshHeaderPenny();
            preview.innerHTML = "";
            preview.appendChild(pennyEl(180, "cheer"));
            draw();
          });
        } else if (canAfford) {
          btn.textContent = "Buy · " + item.price;
          btn.addEventListener("click", () => {
            accrueBank();
            if (Math.floor(state.coins) < item.price) { draw(); return; }
            state.coins -= item.price;
            state.owned.push(item.id);
            state.equipped[item.slot] = item.id;
            save();
            updateWallet(true);
            confetti();
            sfx.big();
            cheer.classList.remove("oops");
            cheer.textContent = "You bought the " + item.name + "! Penny loves it.";
            refreshHeaderPenny();
            preview.innerHTML = "";
            preview.appendChild(pennyEl(180, "cheer"));
            draw();
          });
        } else {
          btn.textContent = "Save " + (item.price - Math.floor(state.coins)) + " more";
          btn.disabled = true;
        }
        card.appendChild(btn);
        grid.appendChild(card);
      });
    }
    draw();
    room.appendChild(grid);
    room.appendChild(cheer);
    room.appendChild(el("p", { class: "hint", html: "Not enough coins? Replay lessons (+2 each), grab your daily allowance (+5), or let the <a href=\"#/bank\">bank</a> grow your savings while you wait!" }));
    app.appendChild(room);
  }

  function renderKindness(app) {
    accrueBank();
    const room = el("section", { class: "room room-kindness" });
    room.appendChild(el("p", { class: "crumbs", html: "<a href=\"#/\">Back to the path</a>" }));
    room.appendChild(el("h1", { text: "Kindness Corner" }));
    room.appendChild(speechRow("Some things feel good for no reward at all! Give a few coins to help — you will <strong>not</strong> get coins or badges back, and that is the whole point. Giving is its own happy.", { expr: "idle", size: 100 }));

    const causes = [
      { id: "shelter", name: "Animal shelter", thanks: "The puppies say woof-woof thank you!" },
      { id: "trees", name: "Plant trees", thanks: "A brand-new tree will grow because of you!" },
      { id: "school", name: "School supplies", thanks: "A kid somewhere gets crayons — thanks to you!" },
      { id: "food", name: "Food for families", thanks: "A warm meal for someone hungry. So kind!" },
    ];
    const card = el("section", { class: "lesson-card" });
    const garden = el("div", { class: "kindness-garden", "aria-label": "Your kindness garden" });
    function drawGarden() {
      const flowers = Math.min(Math.floor(state.kindnessGiven / 5), 48);
      const bloom = '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><circle cx="16" cy="16" r="5" fill="#ffd24a"/><circle cx="16" cy="6" r="5" fill="#f7a8c4"/><circle cx="26" cy="16" r="5" fill="#e05656"/><circle cx="6" cy="16" r="5" fill="#8e7cf2"/><circle cx="16" cy="26" r="5" fill="#2e9d5c"/></svg>';
      garden.innerHTML = flowers > 0
        ? bloom.repeat(flowers)
        : "<span class=\"garden-empty\">Your kindness garden is empty… plant your first flower by giving!</span>";
    }
    drawGarden();
    const cheer = el("p", { class: "cheer", "aria-live": "polite" });
    const note = el("p", { class: "garden-note" });
    function drawNote() {
      note.innerHTML = "One flower grows for every 5 coins you give. Total given: <strong>" + Math.floor(state.kindnessGiven) + " coins</strong> — thank you!";
    }
    drawNote();
    const grid = el("div", { class: "cause-grid" });
    let giving = false;
    function syncGiveButtons() {
      const can = !giving && Math.floor(state.coins) >= 5;
      $$(".big-btn", grid).forEach((b) => { b.disabled = !can; });
    }
    causes.forEach((c) => {
      const cc = el("div", { class: "cause-card" });
      cc.innerHTML = iconSVG("heart") + "<h3>" + c.name + "</h3>";
      const give = el("button", { class: "big-btn gold", type: "button", text: "Give 5 coins" });
      give.addEventListener("click", () => {
        if (giving || give.disabled) return;
        accrueBank();
        if (Math.floor(state.coins) < 5) {
          cheer.classList.add("oops");
          cheer.textContent = "You need 5 coins to give — earn a few first, then share the kindness!";
          sfx.oops();
          syncGiveButtons();
          return;
        }
        giving = true;
        syncGiveButtons();
        state.coins -= 5;
        state.kindnessGiven += 5;
        save();
        updateWallet(true);
        drawGarden();
        drawNote();
        heartFloat(cc);
        sfx.win();
        cheer.classList.remove("oops");
        cheer.textContent = c.thanks;
        setTimeout(() => {
          giving = false;
          syncGiveButtons();
        }, 400);
      });
      cc.appendChild(give);
      grid.appendChild(cc);
    });
    syncGiveButtons();
    card.appendChild(el("h2", { style: "text-align:center;", text: "Your Kindness Garden" }));
    card.appendChild(garden);
    card.appendChild(note);
    card.appendChild(grid);
    card.appendChild(cheer);
    card.appendChild(el("div", { class: "hint", text: "Giving here never pays you back in coins or badges — on purpose. Some of the best things we do with money are just to help someone else." }));
    room.appendChild(card);
    app.appendChild(room);
  }

  function renderQuest(app) {
    const room = el("section", { class: "room room-quest" });
    room.appendChild(el("p", { class: "crumbs", html: "<a href=\"#/\">Back to the path</a>" }));
    room.appendChild(el("h1", { text: "Money Master Quest" }));

    if (state.badges.length < MODULES.length) {
      const left = MODULES.length - state.badges.length;
      room.appendChild(speechRow("The castle gates are locked! Earn <strong>" + left + " more badge" + (left === 1 ? "" : "s") + "</strong> on the path, then come back to prove you are a true Money Master!", { expr: "oops", size: 100 }));
      const card = el("section", { class: "lesson-card" });
      card.appendChild(el("p", { style: "text-align:center;font-weight:700;", text: state.badges.length + " / 9 badges collected" }));
      card.appendChild(el("p", { style: "text-align:center;margin-top:14px;" }, [el("a", { class: "big-btn", href: "#/", text: "To the path!" })]));
      room.appendChild(card);
      app.appendChild(room);
      return;
    }

    room.appendChild(speechRow("This is it, " + escapeHtml(kidName()) + "! Answer <strong>" + QUEST_LEN + " questions</strong>. Get <strong>" + QUEST_PASS + " or more</strong> right to become a Money Master and win <strong>50 coins</strong> + a royal certificate!", { expr: "talk", size: 100 }));
    const card = el("section", { class: "lesson-card quest-card" });
    room.appendChild(card);
    app.appendChild(room);

    const questions = QUEST_POOL.slice().sort(() => Math.random() - 0.5).slice(0, QUEST_LEN);
    let idx = 0;
    let score = 0;

    function drawQuestion() {
      card.innerHTML = "";
      if (idx >= questions.length) { drawResult(); return; }
      const q = questions[idx];
      card.appendChild(el("p", { class: "quest-progress", html: "Question <strong>" + (idx + 1) + "</strong> of " + QUEST_LEN + " · Score: " + score }));
      card.appendChild(el("h2", { class: "quest-q", text: q.q }));
      const answers = el("div", { class: "quest-answers" });
      const shuffled = q.a.slice().sort(() => Math.random() - 0.5);
      let answered = false;
      shuffled.forEach((ans) => {
        const b = el("button", { class: "quest-answer", type: "button", text: ans[0] });
        b.dataset.right = ans[1] ? "1" : "";
        b.addEventListener("click", () => {
          if (answered) return;
          answered = true;
          if (ans[1]) { score++; b.classList.add("right"); sfx.win(); }
          else {
            b.classList.add("wrong");
            sfx.oops();
            $$(".quest-answer", answers).forEach((x) => { if (x.dataset.right) x.classList.add("right"); });
          }
          setTimeout(() => { idx++; drawQuestion(); }, 950);
        });
        answers.appendChild(b);
      });
      card.appendChild(answers);
    }

    function drawResult() {
      card.innerHTML = "";
      const passed = score >= QUEST_PASS;
      state.questBest = Math.max(state.questBest, score);
      if (passed) {
        const firstWin = !state.questDone;
        state.questDone = true;
        save();
        confetti();
        sfx.big();
        card.appendChild(pennyEl(140, "cheer"));
        card.appendChild(el("h2", { style: "text-align:center;", text: kidName() + ", you are a Money Master!" }));
        card.appendChild(el("p", { style: "text-align:center;font-weight:700;", text: "Score: " + score + " / " + QUEST_LEN }));
        const btnRow = el("p", { style: "text-align:center;margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;" });
        btnRow.appendChild(el("a", { class: "big-btn gold", href: "#/certificate", text: "Get my certificate!" }));
        btnRow.appendChild(el("a", { class: "big-btn ghost", href: "#/", text: "Back to the path" }));
        card.appendChild(btnRow);
        if (firstWin) {
          awardCoins(50, card);
          card.appendChild(el("p", { class: "badge-earned", text: "+50 coins for conquering the quest!" }));
        }
      } else {
        save();
        card.appendChild(pennyEl(120, "oops"));
        card.appendChild(el("h2", { style: "text-align:center;", text: "So close! Score: " + score + " / " + QUEST_LEN }));
        card.appendChild(el("p", { style: "text-align:center;font-weight:600;", text: "You need " + QUEST_PASS + " to win. Replay a lesson or two, then storm the castle again!" }));
        const btnRow = el("p", { style: "text-align:center;margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;" });
        const retry = el("button", { class: "big-btn", type: "button", text: "Try again!" });
        retry.addEventListener("click", () => { render(); });
        btnRow.appendChild(retry);
        btnRow.appendChild(el("a", { class: "big-btn ghost", href: "#/", text: "Back to the path" }));
        card.appendChild(btnRow);
      }
    }
    drawQuestion();
  }

  function renderCertificate(app) {
    const room = el("section", { class: "room room-cert" });
    if (!state.questDone) {
      room.appendChild(speechRow("The royal certificate is awarded to Money Masters only! Beat the <a href=\"#/quest\">Money Master Quest</a> first.", { expr: "think" }));
      app.appendChild(room);
      return;
    }
    const date = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const cert = el("section", { class: "cert" });
    cert.innerHTML =
      "<div class=\"cert-inner\">" +
      "<p class=\"cert-eyebrow\">Penny’s Money Adventure</p>" +
      "<h1 class=\"cert-title\">Certificate of Money Mastery</h1>" +
      "<p class=\"cert-line\">proudly awarded to</p>" +
      "<p class=\"cert-name\">" + state.avatar + " " + escapeHtml(kidName()) + " " + state.avatar + "</p>" +
      "<p class=\"cert-line\">for completing all <strong>9 money adventures</strong> and conquering the<br><strong>Money Master Quest</strong> (best score: " + state.questBest + "/" + QUEST_LEN + ")</p>" +
      "<p class=\"cert-date\">" + date + "</p>" +
      "<p class=\"cert-sign\">Penny, President of Penny Bank</p>" +
      "</div>";
    room.appendChild(cert);
    const row = el("p", { class: "no-print", style: "text-align:center;margin-top:18px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;" });
    row.appendChild(el("button", { class: "big-btn gold", type: "button", text: "Print it!", onclick: () => window.print() }));
    row.appendChild(el("a", { class: "big-btn ghost", href: "#/", text: "Back to the path" }));
    room.appendChild(row);
    app.appendChild(room);
  }


  function renderParents(app) {
    const room = el("section", { class: "room room-parents" });
    room.appendChild(el("p", { class: "crumbs", html: "<a href=\"#/\">Back to the path</a>" }));
    room.appendChild(el("h1", { text: "For Grown-Ups" }));
    room.appendChild(el("p", { class: "subtitle", text: "Penny’s Money Adventure teaches personal finance to kids ages 7–12, designed visual-first for visual learners. Everything runs in the browser: no accounts, no ads, no data collection, and no real money anywhere. Progress is stored only on this device." }));

    const stats = el("div", { class: "info-card" });
    stats.innerHTML = "<h3>This device’s adventurer</h3><p><strong>" + escapeHtml(kidName()) + "</strong> " + state.avatar + " · Badges: <strong>" + state.badges.length + "/9</strong> · Coins earned all-time: <strong>" + Math.floor(state.totalEarned) + "</strong> · Bank balance: <strong>" + Math.floor(state.bank.balance) + "</strong> · Interest earned: <strong>" + Math.floor(state.bankEarned) + "</strong> · Quest: <strong>" + (state.questDone ? "passed" : "not yet") + "</strong></p>";
    room.appendChild(stats);

    const eco = el("div", { class: "info-card" });
    eco.innerHTML = "<h3>How the coin economy teaches</h3><p>Kids earn Penny Coins from lessons (+10 first time, +2 on replays), a daily allowance (+5), and badges (+5). They can deposit coins in the Penny Bank — which pays 1% interest per real hour, so returning tomorrow makes compound growth tangible — spend them in the Penny Shop (where expensive items become genuine savings goals), or give them away in the Kindness Corner. Each lesson also ends with a short <em>reflection</em> step, and a daily challenge resurfaces one past question to help it stick. It is the save/spend/give/earn cycle, practiced rather than described.</p>";
    room.appendChild(eco);

    const research = el("div", { class: "info-card" });
    research.innerHTML = "<h3>The evidence behind the design</h3><p>The strongest research (Kaiser &amp; Menkhoff 2020; Kaiser, Lusardi, Menkhoff &amp; Urban 2022 — 76+ randomized trials; the CFPB “building blocks” framework; Whitebread &amp; Bingham 2013, Cambridge) finds that financial lessons reliably raise <strong>knowledge</strong> but only weakly change <strong>behavior</strong>, and that ages 7–12 is the key window when money <em>habits</em> form. So this app pairs every hands-on activity with reflection and feedback, keeps abstract ideas like interest concrete, and — deliberately — <strong>never pays coins for giving</strong>, because rewarding generosity can crowd out the real motive. The biggest lever of all is you: children learn money mostly from their families.</p>";
    room.appendChild(research);

    const scripts = el("div", { class: "info-card" });
    scripts.innerHTML = "<h3>Money talks — quick things to say this week</h3><ul class=\"parent-list\">" +
      "<li><strong>At a shop:</strong> “Is this a <em>need</em> or a <em>want</em>? How can you tell?”</li>" +
      "<li><strong>At the checkout:</strong> “This costs $4. If your allowance is $2 a week, how long to save for it?”</li>" +
      "<li><strong>Paying by card/phone:</strong> “That card isn’t magic — it takes real money from the bank. Where did that money come from?”</li>" +
      "<li><strong>When they want something now:</strong> “Want to buy it today, or save and have something bigger later?” (then honor their choice)</li>" +
      "<li><strong>After a chore:</strong> “You earned this. Save some, spend some, share some?”</li></ul>";
    room.appendChild(scripts);

    const kit = el("div", { class: "info-card family-kit" });
    kit.innerHTML = "<h3>Family Money Night — a 20-minute starter</h3><p>The single best predictor of a child’s money habits is hands-on practice with <em>real</em> money at home. Try this once:</p><ol class=\"parent-list\">" +
      "<li><strong>Make three real jars</strong> — label them SAVE (green), SPEND (blue), SHARE (yellow), matching the app’s colors.</li>" +
      "<li><strong>Give a small real allowance</strong> (even a few coins) and let your child split it across the jars themselves. Resist steering — mistakes are the lesson.</li>" +
      "<li><strong>Pick one real savings goal</strong> together and tape a picture of it to the SAVE jar. Add to it weekly and watch it fill.</li>" +
      "<li><strong>Choose who the SHARE jar helps</strong> — a charity, a sibling, a neighbor. Let them decide; don’t reward it.</li>" +
      "<li><strong>Revisit weekly for a month.</strong> Habits form through repetition, not a single talk.</li></ol>";
    const printBtn = el("button", { class: "big-btn gold no-print", type: "button", text: "Print this kit" });
    printBtn.addEventListener("click", () => {
      document.body.classList.add("print-kit-only");
      window.print();
      setTimeout(() => document.body.classList.remove("print-kit-only"), 500);
    });
    kit.appendChild(printBtn);
    room.appendChild(kit);

    MODULES.forEach((m, i) => {
      const card = el("div", { class: "info-card" });
      card.innerHTML = "<h3>" + (i + 1) + ". " + m.title + "</h3><p>" + m.parent + "</p>";
      room.appendChild(card);
    });

    const tips = el("div", { class: "info-card" });
    tips.innerHTML = "<h3>Tips for the real world</h3><p>Try the 3-jars system at home with real jars. Let kids handle small amounts of real money, make small mistakes safely, and talk openly about family spending choices. The “Read to me” buttons help pre-readers use the site independently.</p>";
    room.appendChild(tips);

    const voiceCard = el("div", { class: "info-card" });
    voiceCard.innerHTML = "<h3>Penny’s voice</h3><p>Penny reads lessons with your device’s built-in speech voices (we pick the most natural English voice we can find). Tap to hear a sample:</p>";
    const hearBtn = el("button", { class: "big-btn gold", type: "button", text: "Hear Penny’s voice" });
    hearBtn.addEventListener("click", () => {
      narrate("Hi there! Follow the glowing path. Every landmark pays Penny Coins you can bank, grow, or spend in my shop!");
    });
    voiceCard.appendChild(hearBtn);
    room.appendChild(voiceCard);

    const danger = el("div", { class: "info-card" });
    danger.innerHTML = "<h3>Start fresh</h3><p>Hand-me-down device or a new adventurer? This erases all progress, coins, and purchases on this device.</p>";
    const resetBtn = el("button", { class: "big-btn ghost", type: "button", text: "Reset all progress" });
    resetBtn.addEventListener("click", () => {
      if (window.confirm("Erase ALL progress, coins, and shop items on this device? This cannot be undone.")) {
        try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LEGACY_PROGRESS_KEY); } catch (e) { /* ignore */ }
        state = loadState();
        updateWallet();
        updateHeaderJar();
        refreshHeaderPenny();
        location.hash = "#/";
        render();
      }
    });
    danger.appendChild(resetBtn);
    room.appendChild(danger);
    app.appendChild(room);
  }

  function renderGlossary(app) {
    const room = el("section", { class: "room room-glossary" });
    room.appendChild(el("p", { class: "crumbs", html: "<a href=\"#/\">Back to the path</a>" }));
    room.appendChild(el("h1", { text: "Money Words in Pictures" }));
    room.appendChild(el("p", { class: "subtitle", text: "Every big money word, with a picture to remember it by. Tap Read to me to hear it!" }));
    const grid = el("div", { class: "gloss-grid" });
    GLOSSARY.forEach((g) => {
      const card = el("div", { class: "gloss-card" });
      card.style.setProperty("--gloss-color", g.color);
      card.innerHTML = iconSVG(g.icon) + "<h3>" + g.term + "</h3><p>" + g.def + "</p>";
      card.appendChild(readBtn(() => g.term + ". " + g.def));
      grid.appendChild(card);
    });
    room.appendChild(grid);
    app.appendChild(room);
  }

  /* ---------- router ---------- */
  function render() {
    if (window.__tick) { clearInterval(window.__tick); window.__tick = null; }
    const app = $("#app");
    app.innerHTML = "";
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    accrueBank();
    updateWallet();
    const hash = location.hash || "#/";
    const modMatch = hash.match(/^#\/module\/([\w-]+)/);
    const siteTitle = "Penny’s Money Adventure";
    if (modMatch) {
      const mod = MODULES.find((m) => m.id === modMatch[1]);
      if (mod) { renderModule(app, mod); document.title = mod.title + " · " + siteTitle; return; }
    }
    if (hash.startsWith("#/bank")) { renderBank(app); document.title = "Penny Bank · " + siteTitle; return; }
    if (hash.startsWith("#/shop")) { renderShop(app); document.title = "Penny Shop · " + siteTitle; return; }
    if (hash.startsWith("#/kindness")) { renderKindness(app); document.title = "Kindness Corner · " + siteTitle; return; }
    if (hash.startsWith("#/quest")) { renderQuest(app); document.title = "Money Master Quest · " + siteTitle; return; }
    if (hash.startsWith("#/certificate")) { renderCertificate(app); document.title = "Certificate · " + siteTitle; return; }
    if (hash.startsWith("#/parents")) { renderParents(app); document.title = "For Grown-Ups · " + siteTitle; return; }
    if (hash.startsWith("#/glossary")) { renderGlossary(app); document.title = "Money Words · " + siteTitle; return; }
    renderHome(app);
    document.title = siteTitle;
  }

  function applyFontPref() {
    let on = false;
    try { on = localStorage.getItem(FONT_KEY) === "1"; } catch (e) { /* ignore */ }
    document.body.classList.toggle("easy-read", on);
    const t = $("#fontToggle");
    if (t) t.setAttribute("aria-pressed", String(on));
  }

  function applySoundPref() {
    const t = $("#soundToggle");
    const icon = $("#soundIcon");
    if (t) t.setAttribute("aria-pressed", String(!!state.sound));
    if (icon) icon.textContent = state.sound ? "🔊" : "🔇";
  }

  /* ---------- boot ---------- */
  if ("speechSynthesis" in window) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  window.addEventListener("hashchange", render);
  const fontBtn = $("#fontToggle");
  if (fontBtn) fontBtn.addEventListener("click", () => {
    const on = !document.body.classList.contains("easy-read");
    try { localStorage.setItem(FONT_KEY, on ? "1" : "0"); } catch (e) { /* ignore */ }
    applyFontPref();
  });
  const soundBtn = $("#soundToggle");
  if (soundBtn) soundBtn.addEventListener("click", () => {
    state.sound = !state.sound;
    save();
    applySoundPref();
    if (state.sound) sfx.pop();
  });

  const walletCoin = $(".wallet-coin");
  if (walletCoin) walletCoin.innerHTML = coinSVG(28);

  applyFontPref();
  applySoundPref();
  refreshHeaderPenny();
  updateHeaderJar();
  updateWallet();
  render();
})();
