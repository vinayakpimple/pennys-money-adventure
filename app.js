/* ============ Penny's Money Adventure — app ============ */
(function () {
  'use strict';

  /* ---------- tiny helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
    }
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function emoji(char, label) {
    return `<span role="img" aria-label="${label}">${char}</span>`;
  }

  /* ================================================================
     SAVE STATE — one localStorage blob, no accounts, device-only
     ================================================================ */
  const SAVE_KEY = 'penny-save-v2';
  const LEGACY_PROGRESS_KEY = 'penny-progress-v1';

  const DEFAULT_STATE = {
    welcomed: false,
    name: '',
    avatar: '🦊',
    badges: [],
    coins: 0,
    totalEarned: 0,
    bank: { balance: 0, lastTs: 0 },
    bankEarned: 0,
    owned: [],
    equipped: {},          // slot -> item id
    activityCleared: {},   // module id -> true
    questDone: false,
    questBest: 0,
    lastAllowance: '',
    unseenInterest: 0,
    lastChallenge: '',     // date string of last daily challenge
    kindnessGiven: 0,      // total coins given away (intrinsic, never repaid)
    voiceName: '',         // parent-chosen read-aloud voice (auto-best if empty)
    sound: true,
  };

  let state = loadState();

  function loadState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* fresh start */ }
    if (!s || typeof s !== 'object') {
      s = JSON.parse(JSON.stringify(DEFAULT_STATE));
      // migrate badges from the first release
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_PROGRESS_KEY));
        if (Array.isArray(legacy)) {
          s.badges = legacy;
          legacy.forEach((id) => { s.activityCleared[id] = true; });
          s.coins = legacy.length * 15;       // retro-pay earlier adventurers
          s.totalEarned = s.coins;
        }
      } catch (e) { /* no legacy save */ }
    }
    // fill any fields added in later versions
    for (const [k, v] of Object.entries(DEFAULT_STATE)) {
      if (s[k] === undefined) s[k] = JSON.parse(JSON.stringify(v));
    }
    return s;
  }

  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  /* ================================================================
     SOUND — tiny WebAudio synth, no files
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
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      vol.gain.setValueAtTime(gain || 0.12, t0);
      vol.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(vol).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    } catch (e) { /* audio blocked */ }
  }

  const sfx = {
    coin() { tone(880, 0.09, 'square', 0.07); tone(1320, 0.14, 'square', 0.05, 0.06); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.11, i * 0.09)); },
    big() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.1)); },
    oops() { tone(240, 0.18, 'sawtooth', 0.06); },
    pop() { tone(620, 0.06, 'sine', 0.1); },
  };

  /* ================================================================
     WALLET + COIN ANIMATION
     ================================================================ */
  function updateWallet(bump) {
    const chip = $('#walletChip');
    $('#coinCount').textContent = Math.floor(state.coins);
    if (bump) {
      chip.classList.remove('bump');
      void chip.offsetWidth;
      chip.classList.add('bump');
    }
  }

  function coinFly(fromEl, count) {
    const layer = $('#coin-layer');
    const target = $('#walletChip').getBoundingClientRect();
    let from = { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    if (fromEl && fromEl.getBoundingClientRect) from = fromEl.getBoundingClientRect();
    const n = Math.min(count, 6);
    for (let i = 0; i < n; i++) {
      const c = el('span', { class: 'fly-coin', text: '🪙' });
      c.style.left = from.left + from.width / 2 + (Math.random() * 40 - 20) + 'px';
      c.style.top = from.top + from.height / 2 + (Math.random() * 20 - 10) + 'px';
      layer.appendChild(c);
      requestAnimationFrame(() => {
        setTimeout(() => {
          c.style.left = target.left + target.width / 2 + 'px';
          c.style.top = target.top + target.height / 2 + 'px';
          c.style.opacity = '0.2';
          c.style.transform = 'scale(0.5)';
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

  /* ================================================================
     BANK — 1% interest per real hour, compounding while away
     ================================================================ */
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

  /* ---------- progress ---------- */
  function markComplete(id) {
    if (!state.badges.includes(id)) {
      state.badges.push(id);
      save();
    }
    updateHeaderJar();
  }

  function updateHeaderJar() {
    const done = state.badges.length;
    const total = MODULES.length;
    $('#jarFill').style.height = Math.round((done / total) * 100) + '%';
    $('#jarLabel').textContent = done + ' / ' + total;
  }

  /* ================================================================
     READ-ALOUD — the browser's built-in speech engine only USES the
     voices installed on the device, and it defaults to the most
     robotic one. Modern browsers ship far better "natural / neural"
     voices (Google, Microsoft Natural, Apple Siri/enhanced) — we just
     have to find and select them instead of taking the default.
     ================================================================ */
  const VOICES = { list: [], best: null, ready: false };

  // Higher score = more natural-sounding. Tuned from the naming
  // conventions the big engines use for their neural voices.
  function scoreVoice(v) {
    const n = (v.name || '').toLowerCase();
    const lang = (v.lang || '').toLowerCase();
    let s = 0;
    if (lang.startsWith('en')) s += 40;              // must be understandable
    if (lang === 'en-us' || lang === 'en-gb') s += 8;
    // strong neural / high-quality markers
    if (/natural|neural|premium|enhanced|wavenet|journey|studio|online/.test(n)) s += 60;
    if (/\bgoogle\b/.test(n)) s += 45;               // Chrome/Android cloud voices
    if (/siri|\baria\b|\bjenny\b|\bemma\b|\bmichelle\b|\blibby\b|\bsonia\b|\bava\b|\ballison\b|samantha/.test(n)) s += 40;
    if (v.localService === false) s += 15;           // cloud voices tend to be nicer
    // penalise the classic robotic engines
    if (/espeak|pico|compact|\bfred\b|\balbert\b|zarvox|robot/.test(n)) s -= 60;
    return s;
  }

  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    const list = window.speechSynthesis.getVoices() || [];
    if (!list.length) return; // not ready yet; voiceschanged will refire
    VOICES.list = list;
    VOICES.ready = true;
    const ranked = list
      .map((v) => ({ v, s: scoreVoice(v) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    VOICES.best = ranked.length ? ranked[0].v : (list.find((v) => (v.lang || '').startsWith('en')) || list[0]);
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
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = currentVoice();
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 0.92;   // a touch slower — clearer for young readers
      u.pitch = 1.05;  // warm, friendly, not chipmunky
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech unavailable — silent, non-blocking */ }
  }

  /* ---------- narration: prefer pre-generated AI audio, else browser TTS ----------
     Fixed narration is pre-rendered to MP3 with the open-source Kokoro voice
     (build step in tts/). If a clip exists for the text, play it — it sounds
     the same and natural on every browser, incl. Safari, and works offline.
     Anything without a clip (e.g. text with the child's name) falls back to
     the device's speech engine. The clip filename is a hash of the cleaned
     text; the SAME hash + clean() run in tts/extract.mjs so they always match. */
  function clean(s) { return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
  function hashStr(s) {
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  let currentClip = null;
  function stopClip() { if (currentClip) { try { currentClip.pause(); } catch (e) { /* ignore */ } currentClip = null; } }
  function playClip(src, fallback) {
    stopClip();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    try {
      const a = new Audio();
      a.preload = 'auto';
      currentClip = a;
      let fell = false;
      const fail = () => { if (fell) return; fell = true; if (currentClip === a) currentClip = null; speak(fallback); };
      a.addEventListener('error', fail);
      a.src = src;
      const p = a.play();
      // Only fall back on a genuine playback failure — a rapid re-tap aborts
      // the previous play() with AbortError, which is not a real error.
      if (p && p.catch) p.catch((err) => { if (!err || err.name !== 'AbortError') fail(); });
    } catch (e) { speak(fallback); }
  }
  function narrate(raw) {
    const t = clean(raw);
    const h = hashStr(t);
    if (window.PENNY_AUDIO && window.PENNY_AUDIO[h]) playClip('audio/' + h + '.mp3', t);
    else speak(t);
  }

  function readBtn(getText) {
    return el('button', {
      class: 'read-btn',
      type: 'button',
      html: emoji('🔊', 'speaker') + ' Read to me',
      onclick: () => narrate(getText()),
    });
  }

  /* ---------- confetti ---------- */
  const CONFETTI_COLORS = ['#2e9d5c', '#3b7dd8', '#f2b41c', '#f7a8c4', '#8e7cf2'];
  function confetti() {
    const layer = $('#confetti-layer');
    for (let i = 0; i < 90; i++) {
      const c = el('div', { class: 'confetto' });
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
      c.style.animationDelay = Math.random() * 0.6 + 's';
      layer.appendChild(c);
      setTimeout(() => c.remove(), 4500);
    }
  }

  /* ================================================================
     PENNY — mascot renderer with equippable accessories
     ================================================================ */
  const PENNY_SVG = $('.penny').outerHTML;

  const SHOP = [
    { id: 'bow', name: 'Cute Bow', emoji: '🎀', price: 15, slot: 'head' },
    { id: 'flower', name: 'Sunny Flower', emoji: '🌸', price: 15, slot: 'head' },
    { id: 'balloon', name: 'Party Balloon', emoji: '🎈', price: 20, slot: 'hand' },
    { id: 'cap', name: 'Cool Cap', emoji: '🧢', price: 25, slot: 'head' },
    { id: 'shades', name: 'Star Shades', emoji: '🕶️', price: 30, slot: 'face' },
    { id: 'tophat', name: 'Fancy Top Hat', emoji: '🎩', price: 40, slot: 'head' },
    { id: 'wand', name: 'Magic Wand', emoji: '🪄', price: 45, slot: 'hand' },
    { id: 'grad', name: 'Smarty Cap', emoji: '🎓', price: 60, slot: 'head' },
    { id: 'rainbow', name: 'Pet Rainbow', emoji: '🌈', price: 100, slot: 'hand' },
    { id: 'crown', name: 'Royal Crown', emoji: '👑', price: 150, slot: 'head' },
  ];

  const SLOT_POS = {
    head: { left: '18%', top: '-16%', size: 0.42 },
    face: { left: '17%', top: '34%', size: 0.3 },
    hand: { left: '76%', top: '46%', size: 0.4 },
  };

  function pennyEl(px) {
    const wrap = el('span', { class: 'penny-wrap' });
    wrap.style.width = px + 'px';
    wrap.innerHTML = PENNY_SVG;
    for (const [slot, itemId] of Object.entries(state.equipped)) {
      const item = SHOP.find((s) => s.id === itemId);
      const pos = SLOT_POS[slot];
      if (!item || !pos) continue;
      const acc = el('span', { class: 'penny-acc', text: item.emoji, 'aria-hidden': 'true' });
      acc.style.left = pos.left;
      acc.style.top = pos.top;
      acc.style.fontSize = px * pos.size + 'px';
      wrap.appendChild(acc);
    }
    return wrap;
  }

  function refreshHeaderPenny() {
    const brand = $('.brand');
    const old = $('.penny-wrap', brand) || $('.penny', brand);
    const fresh = pennyEl(56);
    brand.replaceChild(fresh, old);
  }

  /* ================================================================
     MODULE DATA — every lesson: intro panels → activity → recap
     ================================================================ */
  const MODULES = [
    {
      id: 'what-is-money',
      title: 'What Is Money?',
      emoji: '🪙',
      color: '#8e7cf2',
      tagline: 'Where did money come from?',
      bubble: 'Long ago, there was no money at all. Tap the cards to travel through time!',
      intro: [
        { emoji: '🐔➡️🌽', label: 'chicken traded for corn', text: 'Long ago, people swapped things. A chicken for some corn!' },
        { emoji: '😖', label: 'confused face', text: 'But swapping was tricky. What if nobody wanted your chicken?' },
        { emoji: '🪙', label: 'coin', text: 'So people invented money — something everyone agrees is worth trading.' },
      ],
      activity: 'timeline',
      recap: [
        { emoji: '🔁', label: 'swap arrows', text: 'Before money, people swapped things.' },
        { emoji: '🪙', label: 'coin', text: 'Money makes trading easy for everyone.' },
        { emoji: '📱', label: 'phone', text: 'Money keeps changing — even into numbers on a screen!' },
      ],
      parent: 'Introduces money as a tool for exchange: bartering, why it was hard, and how coins, paper bills, and digital money evolved.',
    },
    {
      id: 'needs-wants',
      title: 'Needs vs. Wants',
      emoji: '🍎',
      color: '#e05656',
      tagline: 'Must-haves and nice-to-haves',
      bubble: 'A NEED keeps you healthy and safe. A WANT is fun but you can live without it. Can you sort them?',
      intro: [
        { emoji: '🍎🏠💧', label: 'apple house water', text: 'NEEDS are things we must have to live — food, water, a home.' },
        { emoji: '🎮🍭🧸', label: 'game candy toy', text: 'WANTS are fun extras — games, candy, toys.' },
        { emoji: '🤔', label: 'thinking face', text: 'Smart savers pay for needs first, then save for wants!' },
      ],
      activity: 'needsWants',
      recap: [
        { emoji: '🍎', label: 'apple', text: 'Needs come first: food, water, home.' },
        { emoji: '🧸', label: 'toy', text: 'Wants are extras we can wait for.' },
        { emoji: '🥇', label: 'medal', text: 'Needs first, wants second — that is the money champion rule!' },
      ],
      parent: 'Builds the core prioritization skill: distinguishing essential needs from optional wants through a sorting game.',
    },
    {
      id: 'earning',
      title: 'Earning Money',
      emoji: '💪',
      color: '#3b7dd8',
      tagline: 'Work turns into money!',
      bubble: 'Money does not fall from the sky — people EARN it by helping and working. Try some jobs!',
      intro: [
        { emoji: '🧑‍🚒🧑‍🍳🧑‍🌾', label: 'firefighter chef farmer', text: 'Grown-ups earn money by doing jobs that help people.' },
        { emoji: '🧹🐕🌻', label: 'broom dog flower', text: 'Kids can earn too — chores, dog walking, watering plants!' },
        { emoji: '💪➡️💵', label: 'muscle then money', text: 'The rule is simple: work first, money after.' },
      ],
      activity: 'chores',
      recap: [
        { emoji: '💪', label: 'muscle', text: 'Money is earned by working and helping.' },
        { emoji: '🐕', label: 'dog', text: 'Even small jobs add up to real money.' },
        { emoji: '🐷', label: 'piggy bank', text: 'What you earn is yours to save, spend, or share!' },
      ],
      parent: 'Connects money to work and effort. Kids complete a chore board and watch small earnings add up.',
    },
    {
      id: 'three-jars',
      title: 'The 3 Jars',
      emoji: '🫙',
      color: '#2e9d5c',
      tagline: 'Save, Spend, Share',
      bubble: 'When money arrives, split it into 3 jars: green to SAVE, blue to SPEND, yellow to SHARE. You choose how!',
      intro: [
        { emoji: '🟢', label: 'green circle', text: 'The green SAVE jar grows your money for big dreams.' },
        { emoji: '🔵', label: 'blue circle', text: 'The blue SPEND jar is for things you buy now.' },
        { emoji: '🟡', label: 'yellow circle', text: 'The yellow SHARE jar helps other people and animals.' },
      ],
      activity: 'jars',
      recap: [
        { emoji: '🟢', label: 'green circle', text: 'Save some — future you says thanks!' },
        { emoji: '🔵', label: 'blue circle', text: 'Spend some — enjoy what you earned.' },
        { emoji: '🟡', label: 'yellow circle', text: 'Share some — giving feels great.' },
      ],
      parent: 'The classic save/spend/share allocation model. Kids drop 10 coins into three color-coded jars and reflect on their split.',
    },
    {
      id: 'budgeting',
      title: 'Make a Budget',
      emoji: '📊',
      color: '#f2b41c',
      tagline: 'A plan for every coin',
      bubble: 'A budget is a PLAN for your money before you spend it. You have $10 — plan every dollar!',
      intro: [
        { emoji: '🗺️', label: 'map', text: 'A budget is like a map — it tells your money where to go.' },
        { emoji: '💵', label: 'money', text: 'Start with what you have. Today: 10 dollars.' },
        { emoji: '✏️', label: 'pencil', text: 'Give every dollar a job before you spend it!' },
      ],
      activity: 'budget',
      recap: [
        { emoji: '🗺️', label: 'map', text: 'A budget is a plan for your money.' },
        { emoji: '🎯', label: 'target', text: 'Every dollar gets a job.' },
        { emoji: '🟢', label: 'green circle', text: 'A good plan always includes some saving.' },
      ],
      parent: 'Hands-on budgeting: allocate a $10 allowance across categories with sliders and a live icon chart until the plan balances.',
    },
    {
      id: 'banks-interest',
      title: 'The Money Garden',
      emoji: '🌱',
      color: '#2e9d5c',
      tagline: 'How banks grow your money',
      bubble: 'A bank is a super-safe piggy bank. It even pays you a little extra — called INTEREST — for keeping money there. Watch it grow!',
      intro: [
        { emoji: '🏦', label: 'bank', text: 'A bank keeps your money safe — safer than under your bed!' },
        { emoji: '🎁', label: 'gift', text: 'Banks add a little extra to your savings. That gift is called interest.' },
        { emoji: '🌱➡️🌳', label: 'seed growing into tree', text: 'Saved money is like a seed. Leave it alone and it grows!' },
      ],
      activity: 'garden',
      recap: [
        { emoji: '🏦', label: 'bank', text: 'Banks keep money safe.' },
        { emoji: '🎁', label: 'gift', text: 'Interest is extra money the bank adds.' },
        { emoji: '⏰', label: 'clock', text: 'The longer you save, the bigger it grows!' },
      ],
      parent: 'Introduces banks and compound growth visually: a slider moves time forward while savings (and a plant) grow. Pairs with the site-wide Penny Bank, where deposited coins earn real interest over real time.',
    },
    {
      id: 'goals',
      title: 'Super Saver Goals',
      emoji: '🎯',
      color: '#3b7dd8',
      tagline: 'Wait for it... it is worth it!',
      bubble: 'Big things cost more than one allowance. Pick a dream, save week by week, and watch yourself get there!',
      intro: [
        { emoji: '🛹', label: 'skateboard', text: 'See something big you want? That is a savings goal!' },
        { emoji: '📅', label: 'calendar', text: 'Save a little every week instead of spending it all.' },
        { emoji: '🏆', label: 'trophy', text: 'Waiting is hard — but reaching your goal feels AMAZING.' },
      ],
      activity: 'goal',
      recap: [
        { emoji: '🎯', label: 'target', text: 'A goal gives your saving a purpose.' },
        { emoji: '🐢', label: 'turtle', text: 'Slow and steady saving wins.' },
        { emoji: '🏆', label: 'trophy', text: 'Patience pays — literally!' },
      ],
      parent: 'Teaches delayed gratification: choose a goal, simulate weekly saving, and experience progress toward a target. The Penny Shop reinforces this with big-ticket items kids must save real Penny Coins for.',
    },
    {
      id: 'lemonade',
      title: 'Lemonade Boss',
      emoji: '🍋',
      color: '#f2b41c',
      tagline: 'Run your own stand!',
      bubble: 'You are the boss of a lemonade stand! Each cup costs you 20¢ to make. Pick a price and see what happens!',
      intro: [
        { emoji: '🍋💧🥤', label: 'lemon water cup', text: 'Making things costs money. Lemons, water, cups: 20¢ per cup.' },
        { emoji: '🏷️', label: 'price tag', text: 'You choose the price. Too high? Fewer people buy!' },
        { emoji: '💰', label: 'money bag', text: 'Money in, minus costs = PROFIT. That is business!' },
      ],
      activity: 'lemonade',
      recap: [
        { emoji: '🧾', label: 'receipt', text: 'Every business has costs.' },
        { emoji: '🏷️', label: 'price tag', text: 'Price changes how many people buy.' },
        { emoji: '💰', label: 'money bag', text: 'Profit = money in − costs.' },
      ],
      parent: 'Basic entrepreneurship: costs, pricing, demand, and profit through a lemonade stand simulation with instant visual results.',
    },
    {
      id: 'digital-safety',
      title: 'Money Safety Shield',
      emoji: '🛡️',
      color: '#e05656',
      tagline: 'Be smart with digital money',
      bubble: 'Money lives on screens now too! Flip each card and guess: smart move or danger zone?',
      intro: [
        { emoji: '📱💳', label: 'phone and card', text: 'Money can be invisible — on cards, phones, and games.' },
        { emoji: '🔒', label: 'lock', text: 'Passwords are secret keys. Real friends never need them.' },
        { emoji: '🧑‍🤝‍🧑', label: 'people together', text: 'Golden rule: always ask a trusted grown-up before paying online.' },
      ],
      activity: 'safety',
      recap: [
        { emoji: '🔒', label: 'lock', text: 'Keep passwords secret — always.' },
        { emoji: '🧑‍🤝‍🧑', label: 'people together', text: 'Ask a grown-up before buying online.' },
        { emoji: '🛡️', label: 'shield', text: 'If it feels weird, stop and tell someone.' },
      ],
      parent: 'Age-appropriate digital money safety: passwords, in-game purchases, scams, and always involving a trusted adult. No real transactions anywhere on this site.',
    },
  ];

  /* ================================================================
     ACTIVITIES — each returns a DOM node and calls onDone() when
     the child has finished the interaction.
     ================================================================ */
  const ACTIVITIES = {

    /* --- 1. tap-to-reveal money timeline --- */
    timeline(onDone) {
      const cards = [
        { emoji: '🐄', label: 'cow', text: 'Swapping animals & food', num: '1' },
        { emoji: '🐚', label: 'shell', text: 'Shiny shells as money', num: '2' },
        { emoji: '🪙💵', label: 'coins and bills', text: 'Coins & paper bills', num: '3' },
        { emoji: '💳📱', label: 'card and phone', text: 'Cards & phone money', num: '4' },
      ];
      let opened = 0;
      const wrap = el('div', {});
      wrap.appendChild(el('p', { class: 'hint', html: emoji('👆', 'pointing finger') + ' Tap each mystery card <strong>in order</strong> to see how money changed through time!' }));
      const grid = el('div', { class: 'reveal-grid' });
      const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });
      cards.forEach((c, i) => {
        const btn = el('button', { class: 'reveal-card', type: 'button', text: '?', 'aria-label': 'Mystery card ' + (i + 1) });
        btn.addEventListener('click', () => {
          if (btn.classList.contains('open')) return;
          if (i !== opened) {
            cheer.textContent = 'Start from card ' + (opened + 1) + ' — time goes in order! ⏳';
            cheer.classList.add('oops');
            btn.classList.add('shake');
            sfx.oops();
            setTimeout(() => btn.classList.remove('shake'), 450);
            return;
          }
          cheer.classList.remove('oops');
          btn.classList.add('open');
          btn.innerHTML = '<span class="story-emoji" role="img" aria-label="' + c.label + '">' + c.emoji + '</span><strong>' + c.num + '. ' + c.text + '</strong>';
          opened++;
          sfx.pop();
          cheer.textContent = opened < cards.length ? 'Nice! Keep going… ' + '⭐'.repeat(opened) : 'You unlocked the whole story of money! 🎉';
          if (opened === cards.length) onDone();
        });
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
      wrap.appendChild(cheer);
      return wrap;
    },

    /* --- 2. needs vs wants sorter --- */
    needsWants(onDone) {
      const items = [
        { emoji: '🍎', name: 'Food', kind: 'need' },
        { emoji: '💧', name: 'Water', kind: 'need' },
        { emoji: '🏠', name: 'A home', kind: 'need' },
        { emoji: '🧥', name: 'Warm coat', kind: 'need' },
        { emoji: '🍭', name: 'Candy', kind: 'want' },
        { emoji: '🎮', name: 'Video game', kind: 'want' },
        { emoji: '🧸', name: 'New toy', kind: 'want' },
        { emoji: '🎢', name: 'Theme park', kind: 'want' },
      ];
      let placed = 0;
      let selected = null;
      const wrap = el('div', {});
      wrap.appendChild(el('p', { class: 'hint', html: emoji('👆', 'pointing finger') + ' Tap a card, then tap the basket where it belongs!' }));
      const pool = el('div', { class: 'sorter-pool', 'aria-label': 'Things to sort' });
      const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });

      function pick(chip) {
        $$('.chip', pool).forEach((c) => c.classList.remove('selected'));
        selected = chip;
        chip.classList.add('selected');
        sfx.pop();
        bins.forEach((b) => b.node.classList.add('armed'));
      }

      items.forEach((it) => {
        const chip = el('button', { class: 'chip', type: 'button', html: '<span class="chip-emoji" role="img" aria-label="' + it.name + '">' + it.emoji + '</span>' + it.name });
        chip.dataset.kind = it.kind;
        chip.addEventListener('click', () => pick(chip));
        pool.appendChild(chip);
      });

      const bins = [
        { kind: 'need', title: 'NEEDS', sub: 'must-haves', color: 'var(--save)', soft: 'var(--save-soft)', icon: '🍎' },
        { kind: 'want', title: 'WANTS', sub: 'nice-to-haves', color: 'var(--spend)', soft: 'var(--spend-soft)', icon: '🧸' },
      ].map((b) => {
        const node = el('div', { class: 'bin', role: 'button', tabindex: '0', 'aria-label': b.title + ' basket' });
        node.style.setProperty('--bin-color', b.color);
        node.style.setProperty('--bin-soft', b.soft);
        node.innerHTML = '<h3>' + emoji(b.icon, b.title) + ' ' + b.title + '<br><small>' + b.sub + '</small></h3><div class="bin-items"></div>';
        function drop() {
          if (!selected) return;
          if (selected.dataset.kind === b.kind) {
            selected.classList.remove('selected');
            selected.disabled = true;
            $('.bin-items', node).appendChild(selected);
            selected = null;
            placed++;
            sfx.coin();
            cheer.classList.remove('oops');
            cheer.textContent = placed === items.length ? 'All sorted — you are a Needs & Wants champ! 🏆' : 'Great sorting! ' + (items.length - placed) + ' to go ⭐';
            if (placed === items.length) onDone();
          } else {
            cheer.classList.add('oops');
            cheer.textContent = 'Hmm, try the other basket! Think: can you live without it? 🤔';
            sfx.oops();
            selected.classList.add('shake');
            const s = selected;
            setTimeout(() => s.classList.remove('shake'), 450);
          }
          bins.forEach((x) => x.node.classList.remove('armed'));
        }
        node.addEventListener('click', drop);
        node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(); } });
        return { ...b, node };
      });

      const binWrap = el('div', { class: 'bins' });
      bins.forEach((b) => binWrap.appendChild(b.node));
      wrap.appendChild(pool);
      wrap.appendChild(binWrap);
      wrap.appendChild(cheer);
      return wrap;
    },

    /* --- 3. chore board --- */
    chores(onDone) {
      const jobs = [
        { emoji: '🐕', name: 'Walk the dog', pay: 2 },
        { emoji: '🧹', name: 'Sweep the floor', pay: 1 },
        { emoji: '🌻', name: 'Water the plants', pay: 1 },
        { emoji: '🍽️', name: 'Set the table', pay: 1 },
        { emoji: '🚗', name: 'Wash the car', pay: 3 },
        { emoji: '📚', name: 'Tidy the books', pay: 2 },
      ];
      let earned = 0;
      let doneCount = 0;
      const wrap = el('div', {});
      wrap.appendChild(el('p', { class: 'hint', html: emoji('👆', 'pointing finger') + ' Tap each chore to do it and watch your piggy bank grow!' }));
      const board = el('div', { class: 'chores' });
      const total = el('div', { class: 'piggy-total', html: emoji('🐷', 'piggy bank') + ' <span>You earned:</span> <span class="amount">$0</span>' });
      const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });

      jobs.forEach((j) => {
        const btn = el('button', {
          class: 'chore', type: 'button',
          html: '<span class="chore-emoji" role="img" aria-label="' + j.name + '">' + j.emoji + '</span>' + j.name + '<span class="chore-pay">+$' + j.pay + '</span>',
        });
        btn.addEventListener('click', () => {
          if (btn.classList.contains('done')) return;
          btn.classList.add('done');
          btn.disabled = true;
          earned += j.pay;
          doneCount++;
          sfx.coin();
          $('.amount', total).textContent = '$' + earned;
          total.classList.remove('bump');
          void total.offsetWidth; // restart animation
          total.classList.add('bump');
          cheer.textContent = doneCount === jobs.length ? 'WOW — you earned $' + earned + ' all by yourself! 💪🎉' : 'Ka-ching! +$' + j.pay + ' 🪙';
          if (doneCount === jobs.length) onDone();
        });
        board.appendChild(btn);
      });

      wrap.appendChild(board);
      wrap.appendChild(total);
      wrap.appendChild(cheer);
      return wrap;
    },

    /* --- 4. three jars coin drop --- */
    jars(onDone) {
      const TOTAL = 10;
      let selected = null;
      const counts = { save: 0, spend: 0, share: 0 };
      const wrap = el('div', {});
      wrap.appendChild(el('p', { class: 'hint', html: emoji('👆', 'pointing finger') + ' You earned <strong>10 coins</strong>! Tap a coin, then tap a jar. YOU decide the split!' }));
      wrap.appendChild(el('div', {
        class: 'legend',
        html: '<span class="l-save">' + emoji('🟢', 'green') + ' Save</span><span class="l-spend">' + emoji('🔵', 'blue') + ' Spend</span><span class="l-share">' + emoji('🟡', 'yellow') + ' Share</span>',
      }));
      const pool = el('div', { class: 'sorter-pool', 'aria-label': 'Your coins' });
      const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });

      for (let i = 0; i < TOTAL; i++) {
        const coin = el('button', { class: 'coin', type: 'button', text: '$1', 'aria-label': 'One dollar coin' });
        coin.addEventListener('click', () => {
          $$('.coin', pool).forEach((c) => c.classList.remove('selected'));
          selected = coin;
          coin.classList.add('selected');
          sfx.pop();
          jarNodes.forEach((j) => j.node.classList.add('armed'));
        });
        pool.appendChild(coin);
      }

      const jarNodes = [
        { key: 'save', title: 'SAVE', icon: '🟢', color: 'var(--save)' },
        { key: 'spend', title: 'SPEND', icon: '🔵', color: 'var(--spend)' },
        { key: 'share', title: 'SHARE', icon: '🟡', color: '#c98f00' },
      ].map((j) => {
        const node = el('div', { class: 'money-jar', role: 'button', tabindex: '0', 'aria-label': j.title + ' jar' });
        node.style.setProperty('--jar-color', j.color);
        node.innerHTML = '<span class="jar-emoji">' + emoji(j.icon, j.title) + '</span><h3>' + j.title + '</h3><div class="jar-glass"><div class="jar-coins"></div></div><div class="jar-count">0 coins</div>';
        function drop() {
          if (!selected) return;
          selected.remove();
          selected = null;
          counts[j.key]++;
          sfx.coin();
          $('.jar-coins', node).style.height = counts[j.key] * 10 + '%';
          $('.jar-count', node).textContent = counts[j.key] + (counts[j.key] === 1 ? ' coin' : ' coins');
          jarNodes.forEach((x) => x.node.classList.remove('armed'));
          const placed = counts.save + counts.spend + counts.share;
          if (placed === TOTAL) {
            let msg = 'All 10 coins have a home! ';
            if (counts.save === 0) msg += 'Next time, try feeding the green SAVE jar too — future you will cheer! 🟢';
            else if (counts.share === 0) msg += 'You are saving like a pro! Maybe share a coin next time too 🟡';
            else msg += 'Saving AND sharing — Penny is SO proud! 🐷💖';
            cheer.textContent = msg;
            onDone();
          } else {
            cheer.textContent = (TOTAL - placed) + ' coins left to place 🪙';
          }
        }
        node.addEventListener('click', drop);
        node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(); } });
        return { ...j, node };
      });

      const row = el('div', { class: 'jars-row' });
      jarNodes.forEach((j) => row.appendChild(j.node));
      wrap.appendChild(pool);
      wrap.appendChild(row);
      wrap.appendChild(cheer);
      return wrap;
    },

    /* --- 5. budget sliders + icon chart --- */
    budget(onDone) {
      const ALLOWANCE = 10;
      const rows = [
        { key: 'snacks', name: 'Snacks', icon: '🍿', color: 'var(--spend)' },
        { key: 'toys', name: 'Toys & fun', icon: '🧸', color: 'var(--spend)' },
        { key: 'gifts', name: 'Sharing', icon: '🎁', color: '#c98f00' },
        { key: 'savings', name: 'Savings', icon: '🟢', color: 'var(--save)' },
      ];
      const vals = { snacks: 0, toys: 0, gifts: 0, savings: 0 };
      let finished = false;
      const wrap = el('div', {});
      wrap.appendChild(el('p', { class: 'hint', html: emoji('👆', 'pointing finger') + ' Slide each bar until <strong>all $10 has a job</strong>. Tip: give Savings at least $1!' }));
      const rowsWrap = el('div', { class: 'budget-rows' });
      const meter = el('div', { class: 'budget-meter', 'aria-live': 'polite' });
      const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });

      function refresh() {
        const total = rows.reduce((s, r) => s + vals[r.key], 0);
        const left = ALLOWANCE - total;
        meter.classList.remove('good', 'over');
        if (left > 0) {
          meter.innerHTML = emoji('💵', 'money') + ' $' + left + ' still needs a job!';
        } else if (left < 0) {
          meter.classList.add('over');
          meter.innerHTML = emoji('😅', 'sweating face') + ' Oops — that is $' + (-left) + ' more than you have!';
        } else {
          meter.classList.add('good');
          meter.innerHTML = emoji('🎯', 'target') + ' Perfect! Every dollar has a job!';
          if (vals.savings >= 1) {
            if (!finished) {
              finished = true;
              cheer.textContent = 'A balanced budget WITH savings — that is money-boss level! 🏆';
              onDone();
            }
          } else {
            cheer.textContent = 'Almost! Slide at least $1 into Savings 🟢';
          }
        }
      }

      rows.forEach((r) => {
        const row = el('div', { class: 'budget-row' });
        row.style.setProperty('--row-color', r.color);
        const label = el('span', { class: 'b-label', html: emoji(r.icon, r.name) + ' ' + r.name });
        const slider = el('input', { type: 'range', min: '0', max: '10', value: '0', step: '1', 'aria-label': r.name + ' dollars' });
        const val = el('span', { class: 'b-val', text: '$0' });
        const bar = el('div', { class: 'icon-bar', 'aria-hidden': 'true' });
        slider.addEventListener('input', () => {
          vals[r.key] = Number(slider.value);
          val.textContent = '$' + slider.value;
          bar.innerHTML = ('<span>' + r.icon + '</span>').repeat(vals[r.key]);
          refresh();
        });
        row.appendChild(label);
        row.appendChild(slider);
        row.appendChild(val);
        row.appendChild(bar);
        rowsWrap.appendChild(row);
      });

      refresh();
      wrap.appendChild(rowsWrap);
      wrap.appendChild(meter);
      wrap.appendChild(cheer);
      return wrap;
    },

    /* --- 6. money garden (interest over time) --- */
    garden(onDone) {
      const START = 10;
      const RATE = 0.1;
      const PLANTS = ['🌰', '🌱', '🌱', '🌿', '🌿', '🪴', '🪴', '🌳', '🌳', '🌳', '🌳✨'];
      let touched = false;
      const wrap = el('div', {});
      wrap.appendChild(el('p', { class: 'hint', html: emoji('👆', 'pointing finger') + ' You put <strong>$10</strong> in the bank. Slide time forward and watch your money garden grow!' }));

      const garden = el('div', { class: 'garden' });
      const plant = el('div', { class: 'plant', role: 'img', 'aria-label': 'growing plant' });
      const stack = el('div', { class: 'coin-stack', 'aria-hidden': 'true' });
      garden.appendChild(plant);
      garden.appendChild(stack);

      const readout = el('p', { class: 'garden-readout', 'aria-live': 'polite' });
      const slider = el('input', { class: 'year-slider', type: 'range', min: '0', max: '10', value: '0', step: '1', 'aria-label': 'Years of saving' });
      const labels = el('div', { class: 'year-labels', html: '<span>Now</span><span>5 years</span><span>10 years</span>' });
      const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });

      function refresh() {
        const years = Number(slider.value);
        const amount = Math.round(START * Math.pow(1 + RATE, years));
        plant.textContent = PLANTS[years];
        plant.style.fontSize = 3.4 + years * 0.5 + 'rem';
        const coins = Math.min(amount, 26);
        stack.innerHTML = '<div class="stack-coin"></div>'.repeat(coins);
        readout.innerHTML = 'After <strong>' + years + (years === 1 ? ' year' : ' years') + '</strong>: <span class="grow-amt">$' + amount + '</span>' +
          (years > 0 ? ' — the bank added <strong>$' + (amount - START) + '</strong> for FREE! 🎁' : ' — your seed is planted 🌰');
        if (years >= 8 && !touched) {
          touched = true;
          cheer.innerHTML = 'Your $10 more than DOUBLED without any work. That is the magic of interest! ✨<br>Psst — the <a href="#/bank">Penny Bank</a> does this with YOUR coins, for real!';
          onDone();
        } else if (!touched && years > 0) {
          cheer.textContent = 'Keep sliding to 8 years or more… 🕰️';
        }
      }

      slider.addEventListener('input', refresh);
      refresh();

      wrap.appendChild(garden);
      wrap.appendChild(readout);
      wrap.appendChild(slider);
      wrap.appendChild(labels);
      wrap.appendChild(cheer);
      return wrap;
    },

    /* --- 7. savings goal simulator --- */
    goal(onDone) {
      const WEEKLY = 4;
      const goals = [
        { emoji: '🎨', name: 'Art set', price: 12 },
        { emoji: '🛹', name: 'Skateboard', price: 20 },
        { emoji: '🤖', name: 'Robot kit', price: 32 },
      ];
      let picked = null;
      let saved = 0;
      let weeks = 0;
      let finished = false;
      const wrap = el('div', {});
      wrap.appendChild(el('p', { class: 'hint', html: emoji('👆', 'pointing finger') + ' Step 1: pick your dream. Step 2: save <strong>$4 every week</strong> until you reach it!' }));

      const choices = el('div', { class: 'goal-choices' });
      const trackWrap = el('div', {});
      const track = el('div', { class: 'goal-track', 'aria-hidden': 'true' });
      const fill = el('div', { class: 'goal-fill' });
      track.appendChild(fill);
      const status = el('p', { class: 'garden-readout', 'aria-live': 'polite' });
      const saveBtn = el('button', { class: 'big-btn green', type: 'button', html: emoji('🐷', 'piggy bank') + ' Save this week’s $4', disabled: 'true' });
      const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });

      goals.forEach((g) => {
        const card = el('button', {
          class: 'goal-card', type: 'button',
          html: '<span class="goal-emoji" role="img" aria-label="' + g.name + '">' + g.emoji + '</span>' + g.name + '<br><span class="goal-price">$' + g.price + '</span>',
        });
        card.addEventListener('click', () => {
          if (finished) return;
          $$('.goal-card', choices).forEach((c) => c.classList.remove('picked'));
          card.classList.add('picked');
          sfx.pop();
          picked = g;
          saved = 0; weeks = 0;
          saveBtn.disabled = false;
          fill.style.width = '0%';
          fill.textContent = '';
          status.innerHTML = 'Goal: <strong>' + g.name + ' ($' + g.price + ')</strong>. That is about ' + Math.ceil(g.price / WEEKLY) + ' weeks of saving. You got this! 💪';
          cheer.textContent = '';
        });
        choices.appendChild(card);
      });

      saveBtn.addEventListener('click', () => {
        if (!picked || finished) return;
        saved = Math.min(saved + WEEKLY, picked.price);
        weeks++;
        sfx.coin();
        const pct = Math.round((saved / picked.price) * 100);
        fill.style.width = pct + '%';
        fill.textContent = '$' + saved;
        if (saved >= picked.price) {
          finished = true;
          saveBtn.disabled = true;
          status.innerHTML = '<span class="grow-amt">GOAL REACHED in ' + weeks + ' weeks!</span> Enjoy your ' + picked.name + ' ' + picked.emoji + ' — you EARNED it!';
          cheer.textContent = 'That waiting superpower is called patience — and it just paid off! 🏆';
          confetti();
          sfx.win();
          onDone();
        } else {
          status.innerHTML = 'Week ' + weeks + ': you saved <strong>$' + saved + '</strong> of $' + picked.price + '. Keep going! 🐢';
        }
      });

      trackWrap.appendChild(track);
      wrap.appendChild(choices);
      wrap.appendChild(trackWrap);
      wrap.appendChild(status);
      wrap.appendChild(el('p', { style: 'text-align:center;margin-top:10px;' }, [saveBtn]));
      wrap.appendChild(cheer);
      return wrap;
    },

    /* --- 8. lemonade stand pricing --- */
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
      const wrap = el('div', {});
      wrap.appendChild(el('p', { class: 'hint', html: emoji('👆', 'pointing finger') + ' Each cup costs you <strong>20¢</strong> to make. Try at least <strong>two prices</strong> and find the best profit!' }));

      const grid = el('div', { class: 'lemonade-grid' });
      const btns = el('div', { class: 'price-btns' });
      const report = el('div', { class: 'stand-report', 'aria-live': 'polite' });
      report.innerHTML = '<p style="text-align:center;font-weight:700;">' + emoji('🍋', 'lemon') + ' Pick a price to open your stand!</p>';
      const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });

      const money = (n) => '$' + n.toFixed(2);

      options.forEach((o) => {
        const b = el('button', {
          class: 'price-btn', type: 'button',
          html: '<span>' + emoji('🥤', 'cup') + ' ' + money(o.price) + ' per cup</span><span>→</span>',
        });
        b.addEventListener('click', () => {
          $$('.price-btn', btns).forEach((x) => x.classList.remove('picked'));
          b.classList.add('picked');
          sfx.pop();
          tried.add(o.price);
          const income = o.price * o.cups;
          const costs = COST * o.cups;
          const profit = income - costs;
          report.innerHTML =
            '<div class="cup-row" role="img" aria-label="' + o.cups + ' cups sold">' + '🥤'.repeat(o.cups) + '</div>' +
            '<div class="report-line"><span>' + emoji('🧑‍🤝‍🧑', 'customers') + ' Cups sold</span><span>' + o.cups + '</span></div>' +
            '<div class="report-line"><span>' + emoji('💵', 'money in') + ' Money in</span><span class="pos">+' + money(income) + '</span></div>' +
            '<div class="report-line"><span>' + emoji('🍋', 'lemon costs') + ' Costs</span><span class="neg">−' + money(costs) + '</span></div>' +
            '<div class="report-line profit"><span>' + emoji('💰', 'profit') + ' PROFIT</span><span class="pos">' + money(profit) + '</span></div>';
          if (tried.size >= 2 && !doneFired) {
            doneFired = true;
            cheer.textContent = 'You compared prices like a real business boss! Which one made the most profit? 🤑';
            onDone();
          } else if (!doneFired) {
            cheer.textContent = 'Interesting! Now try a different price to compare 🔍';
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

    /* --- 9. digital safety flip cards --- */
    safety(onDone) {
      const cards = [
        { emoji: '🧑‍🤝‍🧑', text: 'Ask a grown-up before buying in a game', ok: true, why: 'Smart move! Always check first.' },
        { emoji: '🔑', text: 'Share your password with a game friend', ok: false, why: 'Never! Passwords are secret keys.' },
        { emoji: '🎁', text: '"FREE coins! Just enter your card number!"', ok: false, why: 'Trick alert! Free-stuff pop-ups steal money.' },
        { emoji: '🛑', text: 'Feels weird? Stop and tell a trusted adult', ok: true, why: 'Exactly right — that is your safety shield!' },
        { emoji: '📵', text: 'Click links from strangers about prizes', ok: false, why: 'Nope! Strangers with prizes = scam.' },
        { emoji: '🔒', text: 'Only shop online together with your family', ok: true, why: 'Yes! Shopping is a team sport.' },
      ];
      let flipped = 0;
      const wrap = el('div', {});
      wrap.appendChild(el('p', { class: 'hint', html: emoji('👆', 'pointing finger') + ' Read each card and guess: smart move ✅ or danger zone ❌? Tap to flip and find out!' }));
      const grid = el('div', { class: 'flip-grid' });
      const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });

      cards.forEach((c) => {
        const card = el('button', { class: 'flip-card', type: 'button', 'aria-label': c.text + ' — tap to reveal answer' });
        const inner = el('div', { class: 'flip-inner' });
        inner.appendChild(el('div', { class: 'flip-face flip-front', html: '<span class="flip-emoji" role="img" aria-label="card picture">' + c.emoji + '</span>' + c.text }));
        inner.appendChild(el('div', {
          class: 'flip-face flip-back ' + (c.ok ? 'ok' : 'no'),
          html: '<span class="verdict">' + (c.ok ? '✅' : '❌') + '</span>' + c.why,
        }));
        card.appendChild(inner);
        card.addEventListener('click', () => {
          if (card.classList.contains('flipped')) return;
          card.classList.add('flipped');
          flipped++;
          if (c.ok) sfx.pop(); else sfx.oops();
          cheer.textContent = flipped === cards.length ? 'Shield complete — you are a digital money guardian! 🛡️✨' : flipped + ' of ' + cards.length + ' flipped 🃏';
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
     QUEST — final boss quiz, unlocked at 9 badges
     ================================================================ */
  const QUEST_POOL = [
    { q: 'Which one is a NEED?', a: [['🍎', 'Food', true], ['🎮', 'Video game', false], ['🍭', 'Candy', false]] },
    { q: 'Which jar grows money for later?', a: [['🟢', 'Save jar', true], ['🔵', 'Spend jar', false], ['🟡', 'Share jar', false]] },
    { q: 'How do people get money?', a: [['💪', 'By working', true], ['🌠', 'By wishing', false], ['🛋️', 'By napping', false]] },
    { q: 'What is interest?', a: [['🎁', 'Extra money the bank adds to savings', true], ['💸', 'A fee you pay the bank', false], ['🧾', 'A shopping list', false]] },
    { q: 'What is a budget?', a: [['🗺️', 'A plan for your money', true], ['🛍️', 'Spending everything fast', false], ['🕳️', 'Hiding coins in a hole', false]] },
    { q: 'Money in is $30, costs are $6. What is the profit?', a: [['💰', '$24', true], ['💵', '$30', false], ['🪙', '$6', false]] },
    { q: 'A game friend asks for your password. You…', a: [['🔒', 'Never share it', true], ['🤝', 'Share it if they are nice', false], ['🪙', 'Trade it for coins', false]] },
    { q: 'A goal costs $20. You save $4 each week. How many weeks?', a: [['📅', '5 weeks', true], ['⏱️', '4 weeks', false], ['🗓️', '10 weeks', false]] },
    { q: 'Before money was invented, people…', a: [['🔁', 'Swapped things', true], ['💳', 'Used cards', false], ['📱', 'Paid by phone', false]] },
    { q: 'Which one is a WANT?', a: [['🧸', 'A new toy', true], ['💧', 'Water', false], ['🏠', 'A home', false]] },
    { q: 'Profit = money in minus…', a: [['🧾', 'Costs', true], ['🌠', 'Wishes', false], ['🥤', 'Cups', false]] },
    { q: 'Where is money safest?', a: [['🏦', 'In a bank', true], ['🛏️', 'Under the bed', false], ['🕳️', 'A pocket with a hole', false]] },
    { q: 'A pop-up says "FREE coins — enter your card number!" It is…', a: [['🚨', 'A trick', true], ['🎉', 'A prize', false], ['🎁', 'A gift', false]] },
    { q: 'A good budget gives every dollar a…', a: [['🧑‍🔧', 'Job', true], ['😴', 'Nap', false], ['🎩', 'Hat', false]] },
    { q: 'The longer you leave savings in the bank…', a: [['📈', 'The more they grow', true], ['📉', 'The smaller they get', false], ['🟰', 'Nothing changes', false]] },
    { q: 'The yellow SHARE jar is for…', a: [['💛', 'Helping others', true], ['🍭', 'Buying candy', false], ['🎮', 'Game coins', false]] },
  ];
  const QUEST_LEN = 10;
  const QUEST_PASS = 8;

  /* ================================================================
     REFLECTION — after each activity, the child applies the idea to
     THEIR OWN choices and gets warm, non-judgmental feedback. The
     evidence is clear that "doing" only teaches when paired with
     guided reflection, so this step is never scored or paid.
     ================================================================ */
  const REFLECT = {
    'what-is-money': {
      q: 'Would you rather be paid for chores in CHICKENS or COINS?',
      choices: [
        ['🐔', 'Chickens', 'Ha! But what if the toy shop does not want chickens? That is exactly why people invented coins.'],
        ['🪙', 'Coins', 'Smart! Coins work everywhere because everyone agrees they are worth something.'],
      ],
    },
    'needs-wants': {
      q: 'Think about YOUR life. Which one is a real NEED?',
      choices: [
        ['🍎', 'Food', 'Yes! Food is a true need — your body cannot go without it.'],
        ['🎮', 'A new game', 'Games are a fun WANT! Needs come first, then we save up for wants.'],
        ['🛏️', 'A warm bed', 'Exactly — a safe, warm place to sleep is a big need.'],
      ],
    },
    'earning': {
      q: 'Which job could YOU really do at home this week to earn?',
      choices: [
        ['🧹', 'Tidy up', 'Great pick! Ask a grown-up if you can help — work first, then earn.'],
        ['🐕', 'Help a pet', 'Lovely! Feeding or walking a pet is real, helpful work.'],
        ['🍽️', 'Help cook', 'Yum! Setting the table or helping cook is a real way to pitch in.'],
      ],
    },
    'three-jars': {
      q: 'What would YOU fill your green SAVE jar for?',
      choices: [
        ['🎯', 'Something big', 'Awesome goal! Big things take weeks of saving — and you can do it.'],
        ['🎁', 'A gift for someone', 'So kind! Saving up to give is a wonderful plan.'],
        ['🐷', 'Just to grow it', 'Love it — savers who keep their jar growing feel proud AND ready.'],
      ],
    },
    'budgeting': {
      q: 'When your $10 was running low, what is smartest to protect?',
      choices: [
        ['🟢', 'Some savings', 'Exactly! A great budget always keeps a little for savings.'],
        ['🍿', 'Extra snacks', 'Snacks are fun — but a money boss protects savings first!'],
      ],
    },
    'banks-interest': {
      q: 'Your coins grow while you sleep. What would YOU do with 10 coins?',
      choices: [
        ['🏦', 'Bank them & wait', 'Smart saver! Left alone, they quietly grow bigger. That is interest!'],
        ['🛍️', 'Spend them now', 'That is okay sometimes — but money left in the bank grows. Waiting can pay off!'],
      ],
    },
    'goals': {
      q: 'What real thing would YOU save up for?',
      choices: [
        ['🚲', 'Something big', 'Great goal! Save a bit each week and watch it get closer.'],
        ['🎁', 'A present', 'So thoughtful! Saving up to give feels amazing.'],
        ['📚', 'A hobby', 'Nice! A goal gives your saving a purpose.'],
      ],
    },
    'lemonade': {
      q: 'One price sold MORE cups; another earned more PER cup. Which is smarter?',
      choices: [
        ['💰', 'The best PROFIT one', 'That is the boss move — the biggest PROFIT wins, not the most cups!'],
        ['🥤', 'The most cups', 'Selling lots is exciting — but check the profit! More cups is not always more money.'],
      ],
    },
    'digital-safety': {
      q: 'A game says "Enter your password for FREE coins!" What do YOU do?',
      choices: [
        ['🛑', 'Stop & tell a grown-up', 'PERFECT! That is a trick — you keep your password secret and always ask a grown-up.'],
        ['🔑', 'Type my password', 'Uh oh — that is a trap! Real prizes never need your secret password. Always check with a grown-up.'],
      ],
    },
  };

  /* ================================================================
     VIEWS
     ================================================================ */
  function speechRow(text, opts) {
    const row = el('div', { class: 'hero' + (opts && opts.plain ? ' hero-plain' : '') });
    row.appendChild(pennyEl(opts && opts.size ? opts.size : 110));
    row.appendChild(el('div', { class: 'speech-bubble', html: text }));
    return row;
  }

  function kidName() { return state.name || 'Money Explorer'; }

  function renderHome(app) {
    /* first-visit welcome */
    if (!state.welcomed) {
      const card = el('section', { class: 'lesson-card welcome-card' });
      card.appendChild(speechRow('Hi! I’m <strong>Penny</strong> ' + emoji('👋', 'waving hand') + ' — welcome to my money adventure! What should I call you?'));
      const form = el('div', { class: 'welcome-form' });
      const input = el('input', { class: 'name-input', type: 'text', maxlength: '16', placeholder: 'Your name (or a nickname!)', 'aria-label': 'Your name' });
      const avRow = el('div', { class: 'avatar-row', role: 'radiogroup', 'aria-label': 'Pick your animal buddy' });
      let avatar = state.avatar;
      ['🦊', '🐼', '🦄', '🐯', '🐸', '🐙', '🦖', '🐰'].forEach((a, i) => {
        const b = el('button', { class: 'avatar-btn' + (a === avatar ? ' picked' : ''), type: 'button', text: a, role: 'radio', 'aria-checked': a === avatar ? 'true' : 'false', 'aria-label': 'buddy ' + (i + 1) });
        b.addEventListener('click', () => {
          avatar = a;
          $$('.avatar-btn', avRow).forEach((x) => { x.classList.remove('picked'); x.setAttribute('aria-checked', 'false'); });
          b.classList.add('picked');
          b.setAttribute('aria-checked', 'true');
          sfx.pop();
        });
        avRow.appendChild(b);
      });
      const start = el('button', { class: 'big-btn gold', type: 'button', html: 'Start my adventure! ' + emoji('🚀', 'rocket') });
      start.addEventListener('click', () => {
        state.name = input.value.trim().slice(0, 16);
        state.avatar = avatar;
        state.welcomed = true;
        state.lastAllowance = new Date().toDateString();
        save();
        confetti();
        sfx.big();
        render();
      });
      form.appendChild(input);
      form.appendChild(el('p', { class: 'avatar-label', html: 'Pick your adventure buddy:' }));
      form.appendChild(avRow);
      form.appendChild(el('p', { style: 'text-align:center;margin-top:14px;' }, [start]));
      card.appendChild(form);
      app.appendChild(card);
      return;
    }

    /* daily allowance */
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

    const hello = 'Hi <strong>' + kidName() + '</strong> ' + state.avatar + '! Pick a spot on the map — every game pays <strong>Penny Coins</strong> ' + emoji('🪙', 'coin') + ' you can bank, grow, and spend in my shop!';
    const hero = speechRow(hello);
    // Read a generic, name-free line so this (most-tapped) button uses the
    // pre-generated AI voice instead of falling back to the device engine.
    hero.appendChild(readBtn(() => 'Hi there! Pick a spot on the map. Every game pays Penny Coins you can bank, grow, and spend in my shop!'));
    app.appendChild(hero);
    if (gotAllowance) {
      app.appendChild(el('div', { class: 'allowance-banner', html: emoji('🎁', 'gift') + ' Daily allowance: <strong>+5 coins</strong> for coming back today!' }));
    }

    /* Daily Challenge — spaced review of one past-lesson question */
    app.appendChild(buildDailyChallenge());

    /* Penny Town — bank, shop, kindness, quest */
    app.appendChild(el('h2', { class: 'section-title', html: emoji('🏘️', 'town') + ' Penny Town' }));
    const town = el('ul', { class: 'map town', 'aria-label': 'Penny Town places' });
    const questOpen = state.badges.length === MODULES.length;
    [
      { href: '#/bank', emoji: '🏦', title: 'Penny Bank', tag: 'Coins grow 1% every hour!', color: 'var(--save)', badge: state.bank.balance >= 1 ? '🌱' : '' },
      { href: '#/shop', emoji: '🛍️', title: 'Penny Shop', tag: 'Dress up Penny with your coins', color: 'var(--spend)', badge: state.owned.length ? '🎀' : '' },
      { href: '#/kindness', emoji: '💛', title: 'Kindness Corner', tag: 'Give coins to help — just because', color: '#e05656', badge: state.kindnessGiven >= 1 ? '🌷' : '' },
      questOpen
        ? { href: '#/quest', emoji: '🏰', title: 'Money Master Quest', tag: state.questDone ? 'Conquered! Replay any time' : 'The final challenge awaits!', color: '#8e7cf2', badge: state.questDone ? '👑' : '⚔️' }
        : { href: '#/quest', emoji: '🏰', title: 'Money Master Quest', tag: '🔒 Earn all 9 badges to enter', color: '#9a97b8', badge: '' },
    ].forEach((t) => {
      const li = el('li', { class: 'map-node town-node' });
      li.style.setProperty('--node-color', t.color);
      li.innerHTML = (t.badge ? '<span class="badge-star" role="img" aria-label="status">' + t.badge + '</span>' : '') +
        '<a class="map-link" href="' + t.href + '">' +
        '<span class="map-emoji" role="img" aria-label="' + t.title + '">' + t.emoji + '</span>' +
        '<span class="map-title">' + t.title + '</span>' +
        '<span class="map-tagline">' + t.tag + '</span></a>';
      town.appendChild(li);
    });
    app.appendChild(town);

    /* Adventure map */
    app.appendChild(el('h2', { class: 'section-title', html: emoji('🗺️', 'map') + ' Adventure Map' }));
    app.appendChild(el('div', {
      class: 'legend',
      html: 'Money colors: <span class="l-save">' + emoji('🟢', 'green') + ' Save</span><span class="l-spend">' + emoji('🔵', 'blue') + ' Spend</span><span class="l-share">' + emoji('🟡', 'yellow') + ' Share</span>',
    }));

    const map = el('ul', { class: 'map', 'aria-label': 'Adventure map of money lessons' });
    MODULES.forEach((m, i) => {
      const done = state.badges.includes(m.id);
      const li = el('li', { class: 'map-node' });
      li.style.setProperty('--node-color', m.color);
      li.innerHTML =
        '<span class="level-num" aria-hidden="true">' + (i + 1) + '</span>' +
        (done ? '<span class="badge-star" role="img" aria-label="completed">🌟</span>' : '') +
        '<a class="map-link" href="#/module/' + m.id + '">' +
        '<span class="map-emoji" role="img" aria-label="' + m.title + '">' + m.emoji + '</span>' +
        '<span class="map-title">' + m.title + '</span>' +
        '<span class="map-tagline">' + m.tagline + '</span>' +
        '<span class="reward-chip">' + (done ? emoji('↻', 'replay') + ' Replay +2 🪙' : '+10 🪙') + '</span></a>';
      map.appendChild(li);
    });
    app.appendChild(map);
  }

  /* ---------- Daily Challenge (spaced review) ---------- */
  function buildDailyChallenge() {
    const today = new Date().toDateString();
    const wrap = el('section', { class: 'daily-card' });

    function doneState(msg) {
      wrap.className = 'daily-card done';
      wrap.innerHTML = '<div class="daily-head">' + emoji('⭐', 'star') + ' Daily Challenge</div>' +
        '<p class="daily-done">' + msg + '<br><small>Come back tomorrow for a new one!</small></p>';
    }

    if (state.lastChallenge === today) {
      doneState('Done for today — nice brain work! 🧠');
      return wrap;
    }

    // one stable question per day, drawn from past lessons
    let h = 0;
    for (let i = 0; i < today.length; i++) h = (h * 31 + today.charCodeAt(i)) | 0;
    const q = QUEST_POOL[Math.abs(h) % QUEST_POOL.length];

    wrap.innerHTML = '<div class="daily-head">' + emoji('⭐', 'star') + ' Daily Challenge <span class="daily-reward">+3 🪙</span></div>' +
      '<p class="daily-q">' + q.q + '</p>';
    const answers = el('div', { class: 'daily-answers' });
    const shuffled = q.a.slice().sort(() => Math.random() - 0.5);
    let answered = false;
    shuffled.forEach((ans) => {
      const btn = el('button', { class: 'daily-answer', type: 'button', html: '<span role="img" aria-label="answer">' + ans[0] + '</span> ' + ans[1] });
      btn.dataset.right = ans[2] ? '1' : '';
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        state.lastChallenge = today;
        $$('.daily-answer', answers).forEach((x) => { x.disabled = true; });
        if (ans[2]) {
          btn.classList.add('right');
          awardCoins(3, btn);
          sfx.win();
          save();
          setTimeout(() => doneState('Correct! +3 coins 🎉'), 950);
        } else {
          btn.classList.add('wrong');
          $$('.daily-answer', answers).forEach((x, i) => { if (shuffled[i][2]) x.classList.add('right'); });
          sfx.oops();
          save();
          setTimeout(() => doneState('Good try! You remembered a little more today 💪'), 1500);
        }
      });
      answers.appendChild(btn);
    });
    wrap.appendChild(answers);
    return wrap;
  }

  /* ---------- warm-glow hearts (giving has NO coin reward) ---------- */
  function heartFloat(fromEl) {
    const layer = $('#coin-layer');
    const r = fromEl.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const h = el('span', { class: 'float-heart', text: ['💖', '💛', '💗', '🌸', '✨', '💕'][i % 6] });
      h.style.left = r.left + r.width / 2 + (Math.random() * 44 - 22) + 'px';
      h.style.top = r.top + r.height / 2 + 'px';
      layer.appendChild(h);
      requestAnimationFrame(() => {
        setTimeout(() => {
          h.style.top = (r.top - 90 - Math.random() * 50) + 'px';
          h.style.opacity = '0';
          h.style.transform = 'scale(1.4)';
        }, i * 80);
      });
      setTimeout(() => h.remove(), 1300 + i * 80);
    }
  }

  /* ---------- Kindness Corner (intrinsic giving — never repaid) ---------- */
  function renderKindness(app) {
    accrueBank();
    app.appendChild(el('h1', { html: emoji('💛', 'yellow heart') + ' Kindness Corner' }));
    app.appendChild(speechRow('Some things feel good for no reward at all! Give a few coins to help — you will <strong>not</strong> get coins or badges back, and that is the whole point. Giving is its own happy. ' + emoji('🌷', 'tulip')));

    const causes = [
      { id: 'shelter', emoji: '🐕', name: 'Animal shelter', thanks: 'The puppies say woof-woof THANK YOU!' },
      { id: 'trees', emoji: '🌳', name: 'Plant trees', thanks: 'A brand-new tree will grow because of you!' },
      { id: 'school', emoji: '✏️', name: 'School supplies', thanks: 'A kid somewhere gets crayons — thanks to you!' },
      { id: 'food', emoji: '🍲', name: 'Food for families', thanks: 'A warm meal for someone hungry. So kind!' },
    ];

    const card = el('section', { class: 'lesson-card' });
    card.style.setProperty('--node-color', '#e05656');

    const garden = el('div', { class: 'kindness-garden', 'aria-label': 'Your kindness garden' });
    function drawGarden() {
      const flowers = Math.min(Math.floor(state.kindnessGiven / 5), 48);
      garden.innerHTML = flowers > 0
        ? Array.from({ length: flowers }, (_, i) => ['🌷', '🌸', '🌼', '🌻', '🏵️'][i % 5]).join('')
        : '<span class="garden-empty">Your kindness garden is empty… plant your first flower by giving!</span>';
    }
    drawGarden();

    const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });
    const note = el('p', { class: 'garden-note' });
    function drawNote() {
      note.innerHTML = 'One flower grows for every 5 coins you give. Total given: <strong>' + Math.floor(state.kindnessGiven) + ' coins</strong> — thank you! 💖';
    }
    drawNote();

    const grid = el('div', { class: 'cause-grid' });
    causes.forEach((c) => {
      const cc = el('div', { class: 'cause-card' });
      cc.innerHTML = '<span class="cause-emoji" role="img" aria-label="' + c.name + '">' + c.emoji + '</span><h3>' + c.name + '</h3>';
      const give = el('button', { class: 'big-btn gold', type: 'button', html: 'Give 5 ' + emoji('🪙', 'coin') });
      give.addEventListener('click', () => {
        accrueBank();
        if (Math.floor(state.coins) < 5) {
          cheer.classList.add('oops');
          cheer.textContent = 'You need 5 coins to give — earn a few first, then share the kindness! 🎮';
          sfx.oops();
          return;
        }
        state.coins -= 5;
        state.kindnessGiven += 5;
        save();
        updateWallet(true);
        drawGarden();
        drawNote();
        heartFloat(cc);       // warm glow only — NO coins, NO badge
        sfx.win();
        cheer.classList.remove('oops');
        cheer.textContent = c.thanks + ' 💖';
      });
      cc.appendChild(give);
      grid.appendChild(cc);
    });

    card.appendChild(el('h2', { style: 'text-align:center;', html: emoji('🌼', 'flower') + ' Your Kindness Garden' }));
    card.appendChild(garden);
    card.appendChild(note);
    card.appendChild(grid);
    card.appendChild(cheer);
    card.appendChild(el('div', { class: 'hint', html: emoji('💛', 'heart') + ' Giving here never pays you back in coins or badges — on purpose. Some of the best things we do with money are just to help someone else.' }));
    app.appendChild(card);
  }

  function renderModule(app, mod) {
    let step = 0; // 0 intro, 1 activity, 2 reflect, 3 recap
    const stepNames = ['Watch', 'Play', 'Think', 'Collect'];
    const STEPS = stepNames.length;

    function draw() {
      app.innerHTML = '';
      app.style.setProperty('--node-color', mod.color);

      const head = el('div', { class: 'lesson-head' });
      head.appendChild(el('p', { class: 'crumbs', html: '<a href="#/">' + emoji('🗺️', 'map') + ' Back to map</a>' }));
      const dots = el('div', { class: 'steps-dots', 'aria-label': 'Step ' + (step + 1) + ' of ' + STEPS + ': ' + stepNames[step] });
      for (let i = 0; i < STEPS; i++) dots.appendChild(el('span', { class: 'dot' + (i === step ? ' on' : '') }));
      head.appendChild(dots);
      app.appendChild(head);

      const card = el('section', { class: 'lesson-card' });
      card.style.setProperty('--node-color', mod.color);
      card.appendChild(el('h1', { html: emoji(mod.emoji, mod.title) + ' ' + mod.title }));
      card.appendChild(speechRow(mod.bubble, { plain: true, size: 70 }));

      let bodyText = mod.bubble;
      const next = el('button', { class: 'big-btn', type: 'button' });

      if (step === 0) {
        const row = el('div', { class: 'panel-row' });
        mod.intro.forEach((p) => {
          row.appendChild(el('div', {
            class: 'story-panel',
            html: '<span class="story-emoji" role="img" aria-label="' + p.label + '">' + p.emoji + '</span><p class="story-text">' + p.text + '</p>',
          }));
        });
        card.appendChild(row);
        bodyText += ' ' + mod.intro.map((p) => p.text).join(' ');
        next.innerHTML = 'Let’s play! ' + emoji('🎮', 'game');
        next.addEventListener('click', () => { step = 1; draw(); });
      } else if (step === 1) {
        next.innerHTML = 'Think about it! ' + emoji('💭', 'thought bubble');
        next.disabled = true;
        const firstClear = !state.activityCleared[mod.id];
        const activity = ACTIVITIES[mod.activity](() => {
          next.disabled = false;
          next.classList.add('green');
          const amt = firstClear ? 10 : 2;
          state.activityCleared[mod.id] = true;
          awardCoins(amt, next);
          card.appendChild(el('p', { class: 'badge-earned', html: emoji('🪙', 'coin') + ' +' + amt + ' Penny Coins!' }));
        });
        card.appendChild(activity);
        next.addEventListener('click', () => { step = 2; draw(); });
      } else if (step === 2) {
        // Reflection: apply the idea to your own choices. Never scored or paid.
        const r = REFLECT[mod.id];
        next.innerHTML = 'Collect my stickers! ' + emoji('🌟', 'star');
        next.disabled = true;
        card.appendChild(el('h2', { html: emoji('💭', 'thought bubble') + ' Your turn to think' }));
        card.appendChild(el('p', { class: 'reflect-q', text: r.q }));
        const choicesWrap = el('div', { class: 'reflect-choices' });
        const resp = el('p', { class: 'cheer reflect-resp', 'aria-live': 'polite' });
        r.choices.forEach((c) => {
          const btn = el('button', {
            class: 'reflect-choice', type: 'button',
            html: '<span class="story-emoji" role="img" aria-label="choice">' + c[0] + '</span>' + c[1],
          });
          btn.addEventListener('click', () => {
            $$('.reflect-choice', choicesWrap).forEach((x) => { x.disabled = true; x.classList.remove('chosen'); });
            btn.classList.add('chosen');
            resp.textContent = c[2];
            sfx.pop();
            next.disabled = false;
            next.classList.add('green');
          });
          choicesWrap.appendChild(btn);
        });
        card.appendChild(choicesWrap);
        card.appendChild(resp);
        bodyText = r.q;
        next.addEventListener('click', () => { step = 3; draw(); });
      } else {
        card.appendChild(el('h2', { html: emoji('🌟', 'star') + ' You learned…' }));
        const row = el('div', { class: 'sticker-row' });
        mod.recap.forEach((r) => {
          row.appendChild(el('div', {
            class: 'sticker',
            html: '<span class="story-emoji" role="img" aria-label="' + r.label + '">' + r.emoji + '</span><p>' + r.text + '</p>',
          }));
        });
        card.appendChild(row);
        bodyText = 'You learned: ' + mod.recap.map((r) => r.text).join(' ');
        const already = state.badges.includes(mod.id);
        next.classList.add('gold');
        next.innerHTML = (already ? 'Badge collected! Back to the map ' : 'Collect my badge! ') + emoji('🏅', 'badge');
        next.addEventListener('click', () => {
          if (!state.badges.includes(mod.id)) {
            markComplete(mod.id);
            awardCoins(5, next);
            confetti();
            sfx.big();
            next.innerHTML = 'Back to the map ' + emoji('🗺️', 'map');
            const allDone = state.badges.length === MODULES.length;
            card.appendChild(el('p', {
              class: 'badge-earned',
              html: emoji('🏅', 'badge') + ' New badge + 5 coins! ' +
                (allDone ? '<br>' + emoji('🏰', 'castle') + ' ALL 9 BADGES! The <a href="#/quest">Money Master Quest</a> is now open!' : ''),
            }));
            next.onclick = () => { location.hash = '#/'; };
          } else {
            location.hash = '#/';
          }
        });
      }

      const foot = el('div', { class: 'lesson-foot' });
      foot.appendChild(readBtn(() => bodyText.replace(/<[^>]+>/g, '')));
      foot.appendChild(next);
      card.appendChild(foot);
      app.appendChild(card);
      app.focus();
    }

    draw();
  }

  /* ---------- Penny Bank ---------- */
  function renderBank(app) {
    accrueBank();
    const gained = state.unseenInterest;
    state.unseenInterest = 0;
    save();

    app.appendChild(el('h1', { html: emoji('🏦', 'bank') + ' Penny Bank' }));
    const intro = speechRow('Welcome to my bank, ' + kidName() + '! Coins you keep here earn <strong>1% interest every hour</strong> — even while you sleep! ' + emoji('😴', 'sleeping') + ' Come back tomorrow and see the magic.');
    app.appendChild(intro);

    if (gained >= 1) {
      app.appendChild(el('div', {
        class: 'allowance-banner grow-banner',
        html: emoji('🌱', 'sprout') + ' While you were away, your savings grew by <strong>+' + Math.floor(gained) + ' coins</strong> — that is interest!',
      }));
      sfx.win();
    }

    const card = el('section', { class: 'lesson-card bank-card' });

    const balances = el('div', { class: 'bank-balances' });
    const walletBox = el('div', { class: 'balance-box wallet-box', html: '<h3>' + emoji('👛', 'purse') + ' Wallet</h3><p class="balance-num" id="bWallet">' + Math.floor(state.coins) + '</p><p class="balance-sub">coins ready to use</p>' });
    const bankBox = el('div', { class: 'balance-box bank-box', html: '<h3>' + emoji('🏦', 'bank') + ' In the bank</h3><p class="balance-num" id="bBank">' + Math.floor(state.bank.balance) + '</p><p class="balance-sub" id="bGrow">growing every hour…</p>' });
    balances.appendChild(walletBox);
    balances.appendChild(bankBox);
    card.appendChild(balances);

    const btnRow = el('div', { class: 'bank-btns' });
    const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });

    function refresh() {
      $('#bWallet').textContent = Math.floor(state.coins);
      $('#bBank').textContent = Math.floor(state.bank.balance);
      updateWallet();
      const bal = state.bank.balance;
      const day = bal * Math.pow(1 + HOURLY_RATE, 24) - bal;
      const week = bal * Math.pow(1 + HOURLY_RATE, 24 * 7) - bal;
      $('#bGrow').innerHTML = bal >= 1
        ? 'by tomorrow: <strong>+' + Math.max(1, Math.floor(day)) + '</strong> · in a week: <strong>+' + Math.floor(week) + '</strong>'
        : 'deposit coins to start growing!';
    }

    function move(kind, amount) {
      accrueBank();
      if (kind === 'in') {
        const amt = Math.min(amount === 'all' ? Math.floor(state.coins) : amount, Math.floor(state.coins));
        if (amt <= 0) { cheer.classList.add('oops'); cheer.textContent = 'Your wallet is empty — play a lesson to earn coins! 🎮'; sfx.oops(); return; }
        state.coins -= amt;
        state.bank.balance += amt;
        cheer.classList.remove('oops');
        cheer.textContent = 'Deposited ' + amt + ' coins — watch them grow! 🌱';
        sfx.coin();
      } else {
        const avail = Math.floor(state.bank.balance);
        const amt = Math.min(amount === 'all' ? avail : amount, avail);
        if (amt <= 0) { cheer.classList.add('oops'); cheer.textContent = 'Nothing in the bank yet! 🏦'; sfx.oops(); return; }
        state.bank.balance -= amt;
        state.coins += amt;
        cheer.classList.remove('oops');
        cheer.textContent = 'Withdrew ' + amt + ' coins to your wallet 👛';
        sfx.coin();
      }
      save();
      refresh();
    }

    [
      { label: emoji('⬇️', 'deposit') + ' Put in 10', fn: () => move('in', 10), cls: 'green' },
      { label: emoji('⬇️', 'deposit') + ' Put in ALL', fn: () => move('in', 'all'), cls: 'green' },
      { label: emoji('⬆️', 'withdraw') + ' Take out 10', fn: () => move('out', 10), cls: 'ghost' },
      { label: emoji('⬆️', 'withdraw') + ' Take out ALL', fn: () => move('out', 'all'), cls: 'ghost' },
    ].forEach((b) => {
      btnRow.appendChild(el('button', { class: 'big-btn ' + b.cls, type: 'button', html: b.label, onclick: b.fn }));
    });
    card.appendChild(btnRow);
    card.appendChild(cheer);

    card.appendChild(el('div', {
      class: 'hint',
      html: emoji('🧠', 'brain') + ' <strong>Why does the bank pay you?</strong> Real banks pay interest too (a little slower!). Money you do not spend today quietly earns more money. Total interest you have earned here: <strong>' + Math.floor(state.bankEarned) + ' coins</strong> 🌱',
    }));

    app.appendChild(card);
    refresh();

    // gentle live tick so kids can literally watch it grow
    window.__tick = setInterval(() => { accrueBank(); refresh(); }, 5000);
  }

  /* ---------- Penny Shop ---------- */
  function renderShop(app) {
    app.appendChild(el('h1', { html: emoji('🛍️', 'shop') + ' Penny Shop' }));
    app.appendChild(speechRow('Spend your hard-earned coins to dress me up! The fancy stuff costs more — a perfect <strong>savings goal</strong> ' + emoji('🎯', 'target') + '. I wear what you pick everywhere!'));

    const preview = el('div', { class: 'shop-preview' });
    preview.appendChild(pennyEl(150));
    app.appendChild(preview);

    const cheer = el('p', { class: 'cheer', 'aria-live': 'polite' });
    const grid = el('div', { class: 'shop-grid' });

    function draw() {
      grid.innerHTML = '';
      SHOP.forEach((item) => {
        const owned = state.owned.includes(item.id);
        const equipped = state.equipped[item.slot] === item.id;
        const canAfford = Math.floor(state.coins) >= item.price;
        const card = el('div', { class: 'shop-card' + (equipped ? ' equipped' : '') });
        card.innerHTML = '<span class="shop-emoji" role="img" aria-label="' + item.name + '">' + item.emoji + '</span>' +
          '<h3>' + item.name + '</h3>' +
          '<p class="shop-price">' + (owned ? emoji('✔️', 'owned') + ' Yours!' : item.price + ' 🪙') + '</p>';
        const btn = el('button', { class: 'big-btn ' + (owned ? (equipped ? 'ghost' : 'gold') : canAfford ? 'green' : 'ghost'), type: 'button' });
        if (owned) {
          btn.innerHTML = equipped ? 'Take off' : 'Wear it!';
          btn.addEventListener('click', () => {
            if (equipped) delete state.equipped[item.slot];
            else state.equipped[item.slot] = item.id;
            save();
            sfx.pop();
            refreshHeaderPenny();
            preview.innerHTML = '';
            preview.appendChild(pennyEl(150));
            draw();
          });
        } else if (canAfford) {
          btn.innerHTML = 'Buy · ' + item.price + ' 🪙';
          btn.addEventListener('click', () => {
            accrueBank();
            if (Math.floor(state.coins) < item.price) { draw(); return; }
            state.coins -= item.price;
            state.owned.push(item.id);
            state.equipped[item.slot] = item.id;
            save();
            updateWallet(true);
            confetti();
            sfx.big();
            cheer.classList.remove('oops');
            cheer.textContent = 'You bought the ' + item.name + '! Penny LOVES it ' + item.emoji + '💖';
            refreshHeaderPenny();
            preview.innerHTML = '';
            preview.appendChild(pennyEl(150));
            draw();
          });
        } else {
          const needed = item.price - Math.floor(state.coins);
          btn.innerHTML = 'Save ' + needed + ' more 🪙';
          btn.disabled = true;
        }
        card.appendChild(btn);
        grid.appendChild(card);
      });
    }

    draw();
    app.appendChild(grid);
    app.appendChild(cheer);
    app.appendChild(el('p', { class: 'hint', html: emoji('💡', 'idea') + ' Not enough coins? Replay lessons (+2 each), grab your daily allowance (+5), or let the <a href="#/bank">bank</a> grow your savings while you wait!' }));
  }

  /* ---------- Money Master Quest ---------- */
  function renderQuest(app) {
    app.appendChild(el('h1', { html: emoji('🏰', 'castle') + ' Money Master Quest' }));

    if (state.badges.length < MODULES.length) {
      const left = MODULES.length - state.badges.length;
      app.appendChild(speechRow('The castle gates are locked! ' + emoji('🔒', 'lock') + ' Earn <strong>' + left + ' more badge' + (left === 1 ? '' : 's') + '</strong> on the Adventure Map, then come back to prove you are a true Money Master!'));
      const card = el('section', { class: 'lesson-card', html: '<p style="text-align:center;font-size:4rem;">🔒🏰</p><p style="text-align:center;font-weight:700;">' + state.badges.length + ' / 9 badges collected</p>' });
      card.appendChild(el('p', { style: 'text-align:center;margin-top:14px;' }, [el('a', { class: 'big-btn', href: '#/', html: 'To the map! ' + emoji('🗺️', 'map') })]));
      app.appendChild(card);
      return;
    }

    app.appendChild(speechRow('This is it, ' + kidName() + '! Answer <strong>' + QUEST_LEN + ' questions</strong>. Get <strong>' + QUEST_PASS + ' or more</strong> right to become a MONEY MASTER and win <strong>50 coins</strong> + a royal certificate! ' + emoji('👑', 'crown')));

    const card = el('section', { class: 'lesson-card quest-card' });
    app.appendChild(card);

    const questions = QUEST_POOL.slice().sort(() => Math.random() - 0.5).slice(0, QUEST_LEN);
    let idx = 0;
    let score = 0;

    function drawQuestion() {
      card.innerHTML = '';
      if (idx >= questions.length) { drawResult(); return; }
      const q = questions[idx];
      card.appendChild(el('p', { class: 'quest-progress', html: 'Question <strong>' + (idx + 1) + '</strong> of ' + QUEST_LEN + ' · Score: ' + score + ' ⭐' }));
      card.appendChild(el('h2', { class: 'quest-q', text: q.q }));
      const answers = el('div', { class: 'quest-answers' });
      const shuffled = q.a.slice().sort(() => Math.random() - 0.5);
      let answered = false;
      shuffled.forEach((ans) => {
        const em = ans[0], label = ans[1], right = ans[2];
        const b = el('button', {
          class: 'quest-answer', type: 'button',
          html: '<span class="story-emoji" role="img" aria-label="answer picture">' + em + '</span>' + label,
        });
        b.dataset.right = right ? '1' : '';
        b.addEventListener('click', () => {
          if (answered) return;
          answered = true;
          if (right) {
            score++;
            b.classList.add('right');
            sfx.win();
          } else {
            b.classList.add('wrong');
            sfx.oops();
            $$('.quest-answer', answers).forEach((x) => { if (x.dataset.right) x.classList.add('right'); });
          }
          setTimeout(() => { idx++; drawQuestion(); }, 950);
        });
        answers.appendChild(b);
      });
      card.appendChild(answers);
    }

    function drawResult() {
      card.innerHTML = '';
      const passed = score >= QUEST_PASS;
      state.questBest = Math.max(state.questBest, score);
      if (passed) {
        const firstWin = !state.questDone;
        state.questDone = true;
        save();
        confetti();
        sfx.big();
        card.appendChild(el('p', { style: 'text-align:center;font-size:4.5rem;', html: '👑🏆👑' }));
        card.appendChild(el('h2', { style: 'text-align:center;', html: kidName() + ', you are a MONEY MASTER!' }));
        card.appendChild(el('p', { style: 'text-align:center;font-weight:700;', html: 'Score: ' + score + ' / ' + QUEST_LEN }));
        const btnRow = el('p', { style: 'text-align:center;margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;' });
        btnRow.appendChild(el('a', { class: 'big-btn gold', href: '#/certificate', html: emoji('📜', 'certificate') + ' Get my certificate!' }));
        btnRow.appendChild(el('a', { class: 'big-btn ghost', href: '#/', html: 'Back to map' }));
        card.appendChild(btnRow);
        if (firstWin) {
          awardCoins(50, card);
          card.appendChild(el('p', { class: 'badge-earned', html: emoji('🪙', 'coins') + ' +50 coins for conquering the quest!' }));
        }
      } else {
        save();
        card.appendChild(el('p', { style: 'text-align:center;font-size:4rem;', html: '💪🐷' }));
        card.appendChild(el('h2', { style: 'text-align:center;', html: 'So close! Score: ' + score + ' / ' + QUEST_LEN }));
        card.appendChild(el('p', { style: 'text-align:center;font-weight:600;', html: 'You need ' + QUEST_PASS + ' to win. Replay a lesson or two, then storm the castle again!' }));
        const btnRow = el('p', { style: 'text-align:center;margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;' });
        const retry = el('button', { class: 'big-btn', type: 'button', html: 'Try again! ' + emoji('⚔️', 'swords') });
        retry.addEventListener('click', () => { render(); });
        btnRow.appendChild(retry);
        btnRow.appendChild(el('a', { class: 'big-btn ghost', href: '#/', html: 'Back to map' }));
        card.appendChild(btnRow);
      }
    }

    drawQuestion();
  }

  /* ---------- Certificate ---------- */
  function renderCertificate(app) {
    if (!state.questDone) {
      app.appendChild(speechRow('The royal certificate is awarded to Money Masters only! Beat the <a href="#/quest">Money Master Quest</a> first ' + emoji('🏰', 'castle')));
      return;
    }
    const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const cert = el('section', { class: 'cert' });
    cert.innerHTML =
      '<div class="cert-inner">' +
      '<p class="cert-eyebrow">🌟 Penny’s Money Adventure 🌟</p>' +
      '<h1 class="cert-title">Certificate of Money Mastery</h1>' +
      '<p class="cert-line">proudly awarded to</p>' +
      '<p class="cert-name">' + state.avatar + ' ' + kidName() + ' ' + state.avatar + '</p>' +
      '<p class="cert-line">for completing all <strong>9 money adventures</strong> and conquering the<br><strong>Money Master Quest</strong> (best score: ' + state.questBest + '/' + QUEST_LEN + ')</p>' +
      '<p class="cert-badges">🪙 🍎 💪 🫙 📊 🌱 🎯 🍋 🛡️</p>' +
      '<p class="cert-date">' + date + '</p>' +
      '<p class="cert-sign">🐷 Penny, President of Penny Bank</p>' +
      '</div>';
    app.appendChild(cert);
    const row = el('p', { class: 'no-print', style: 'text-align:center;margin-top:18px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;' });
    row.appendChild(el('button', { class: 'big-btn gold', type: 'button', html: emoji('🖨️', 'printer') + ' Print it!', onclick: () => window.print() }));
    row.appendChild(el('a', { class: 'big-btn ghost', href: '#/', html: 'Back to map' }));
    app.appendChild(row);
  }

  /* ---------- Grown-ups ---------- */
  function renderParents(app) {
    app.appendChild(el('h1', { html: emoji('🧑‍🏫', 'teacher') + ' For Grown-Ups' }));
    app.appendChild(el('p', {
      class: 'subtitle',
      text: 'Penny’s Money Adventure teaches personal finance to kids ages 7–12, designed visual-first for visual learners. Everything runs in the browser: no accounts, no ads, no data collection, and no real money anywhere. Progress is stored only on this device.',
    }));

    const stats = el('div', { class: 'info-card' });
    stats.innerHTML = '<h3>' + emoji('📊', 'chart') + ' This device’s adventurer</h3>' +
      '<p><strong>' + kidName() + '</strong> ' + state.avatar + ' · Badges: <strong>' + state.badges.length + '/9</strong> · Coins earned all-time: <strong>' + Math.floor(state.totalEarned) + '</strong> · Bank balance: <strong>' + Math.floor(state.bank.balance) + '</strong> · Interest earned: <strong>' + Math.floor(state.bankEarned) + '</strong> · Quest: <strong>' + (state.questDone ? 'passed 👑' : 'not yet') + '</strong></p>';
    app.appendChild(stats);

    const eco = el('div', { class: 'info-card' });
    eco.innerHTML = '<h3>' + emoji('🪙', 'coin') + ' How the coin economy teaches</h3>' +
      '<p>Kids earn Penny Coins from lessons (+10 first time, +2 on replays), a daily allowance (+5), and badges (+5). They can deposit coins in the Penny Bank — which pays 1% interest per real hour, so returning tomorrow makes compound growth tangible — spend them in the Penny Shop (where expensive items become genuine savings goals), or give them away in the Kindness Corner. Each lesson also ends with a short <em>reflection</em> step, and a daily challenge resurfaces one past question to help it stick. It is the save/spend/give/earn cycle, practiced rather than described.</p>';
    app.appendChild(eco);

    const research = el('div', { class: 'info-card' });
    research.innerHTML = '<h3>' + emoji('🔬', 'microscope') + ' The evidence behind the design</h3>' +
      '<p>The strongest research (Kaiser &amp; Menkhoff 2020; Kaiser, Lusardi, Menkhoff &amp; Urban 2022 — 76+ randomized trials; the CFPB “building blocks” framework; Whitebread &amp; Bingham 2013, Cambridge) finds that financial lessons reliably raise <strong>knowledge</strong> but only weakly change <strong>behavior</strong>, and that ages 7–12 is the key window when money <em>habits</em> form. So this app pairs every hands-on activity with reflection and feedback (guided “learning by doing,” which the evidence favors over facts alone), keeps abstract ideas like interest concrete, and — deliberately — <strong>never pays coins for giving</strong>, because rewarding generosity can crowd out the real motive. The biggest lever of all, though, is you: children learn money mostly from their families. The kit below turns that into a few concrete things to do at home.</p>';
    app.appendChild(research);

    const scripts = el('div', { class: 'info-card' });
    scripts.innerHTML = '<h3>' + emoji('💬', 'speech') + ' Money talks — quick things to say this week</h3>' +
      '<ul class="parent-list">' +
      '<li><strong>At a shop:</strong> “Is this a <em>need</em> or a <em>want</em>? How can you tell?”</li>' +
      '<li><strong>At the checkout:</strong> “This costs $4. If your allowance is $2 a week, how long to save for it?”</li>' +
      '<li><strong>Paying by card/phone:</strong> “That card isn’t magic — it takes real money from the bank. Where did that money come from?”</li>' +
      '<li><strong>When they want something now:</strong> “Want to buy it today, or save and have something bigger later?” (then honor their choice)</li>' +
      '<li><strong>After a chore:</strong> “You earned this. Save some, spend some, share some?”</li>' +
      '</ul>';
    app.appendChild(scripts);

    const kit = el('div', { class: 'info-card family-kit' });
    kit.innerHTML = '<h3>' + emoji('🌙', 'moon') + ' Family Money Night — a 20-minute starter</h3>' +
      '<p>The single best predictor of a child’s money habits is hands-on practice with <em>real</em> money at home. Try this once:</p>' +
      '<ol class="parent-list">' +
      '<li><strong>Make three real jars</strong> — label them SAVE (green), SPEND (blue), SHARE (yellow), matching the app’s colors.</li>' +
      '<li><strong>Give a small real allowance</strong> (even a few coins) and let your child split it across the jars themselves. Resist steering — mistakes are the lesson.</li>' +
      '<li><strong>Pick one real savings goal</strong> together and tape a picture of it to the SAVE jar. Add to it weekly and watch it fill.</li>' +
      '<li><strong>Choose who the SHARE jar helps</strong> — a charity, a sibling, a neighbor. Let them decide; don’t reward it.</li>' +
      '<li><strong>Revisit weekly for a month.</strong> Habits form through repetition, not a single talk.</li>' +
      '</ol>';
    const printBtn = el('button', { class: 'big-btn gold no-print', type: 'button', html: emoji('🖨️', 'printer') + ' Print this kit' });
    printBtn.addEventListener('click', () => {
      document.body.classList.add('print-kit-only');
      window.print();
      setTimeout(() => document.body.classList.remove('print-kit-only'), 500);
    });
    kit.appendChild(printBtn);
    app.appendChild(kit);

    MODULES.forEach((m, i) => {
      const card = el('div', { class: 'info-card' });
      card.innerHTML = '<h3>' + emoji(m.emoji, m.title) + ' ' + (i + 1) + '. ' + m.title + '</h3><p>' + m.parent + '</p>';
      app.appendChild(card);
    });

    const tips = el('div', { class: 'info-card' });
    tips.innerHTML = '<h3>' + emoji('💡', 'light bulb') + ' Tips for the real world</h3>' +
      '<p>Try the 3-jars system at home with real jars. Let kids handle small amounts of real money, make small mistakes safely, and talk openly about family spending choices. The “Read to me” buttons help pre-readers use the site independently. On a tablet, use “Add to Home Screen” — the site installs like an app and works offline.</p>';
    app.appendChild(tips);

    const voiceCard = el('div', { class: 'info-card' });
    voiceCard.innerHTML = '<h3>' + emoji('🗣️', 'speaking head') + ' Penny’s reading voice</h3>' +
      '<p>The “Read to me” buttons use the voices <em>installed on this device</em> — the app can’t change how they sound, only which one it picks. Older devices fall back to a robotic voice; choose the most natural one below. Most phones and computers can download much better “natural / enhanced / neural” voices free in their own accessibility or language settings, and they’ll show up in this list automatically.</p>';
    const pickRow = el('div', { class: 'voice-row' });
    const select = el('select', { class: 'voice-select', 'aria-label': 'Choose Penny’s reading voice' });
    function populateVoices() {
      if (!select.isConnected) return;
      loadVoices();
      const en = VOICES.list
        .filter((v) => (v.lang || '').toLowerCase().startsWith('en'))
        .map((v) => ({ v, s: scoreVoice(v) }))
        .sort((a, b) => b.s - a.s);
      select.innerHTML = '';
      select.appendChild(el('option', { value: '', text: 'Auto — best available' + (VOICES.best ? ' (' + VOICES.best.name + ')' : '') }));
      en.forEach(({ v }) => {
        const o = el('option', { value: v.name, text: v.name + ' · ' + v.lang });
        if (v.name === state.voiceName) o.selected = true;
        select.appendChild(o);
      });
      if (!en.length) select.appendChild(el('option', { value: '', text: 'No extra voices found on this device yet' }));
    }
    select.addEventListener('change', () => { state.voiceName = select.value; save(); });
    const testBtn = el('button', { class: 'big-btn ghost', type: 'button', html: emoji('🔊', 'speaker') + ' Test voice' });
    testBtn.addEventListener('click', () => speak('Hi! I am Penny. Let us learn about money together!'));
    pickRow.appendChild(select);
    pickRow.appendChild(testBtn);
    voiceCard.appendChild(pickRow);
    app.appendChild(voiceCard);
    populateVoices(); // after the select is connected to the DOM
    if ('speechSynthesis' in window) {
      const onVoices = () => { if (!select.isConnected) { window.speechSynthesis.removeEventListener('voiceschanged', onVoices); return; } populateVoices(); };
      window.speechSynthesis.addEventListener('voiceschanged', onVoices);
    }

    const danger = el('div', { class: 'info-card' });
    danger.innerHTML = '<h3>' + emoji('🔄', 'reset') + ' Start fresh</h3><p>Hand-me-down device or a new adventurer? This erases all progress, coins, and purchases on this device.</p>';
    const resetBtn = el('button', { class: 'big-btn ghost', type: 'button', html: 'Reset all progress' });
    resetBtn.addEventListener('click', () => {
      if (window.confirm('Erase ALL progress, coins, and shop items on this device? This cannot be undone.')) {
        try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LEGACY_PROGRESS_KEY); } catch (e) { /* ignore */ }
        state = loadState();
        updateWallet();
        updateHeaderJar();
        refreshHeaderPenny();
        location.hash = '#/';
        render();
      }
    });
    danger.appendChild(resetBtn);
    app.appendChild(danger);
  }

  /* ---------- Glossary ---------- */
  const GLOSSARY = [
    { term: 'Money', emoji: '🪙', label: 'coin', color: '#8e7cf2', def: 'What we trade for things we need and want.' },
    { term: 'Earn', emoji: '💪', label: 'muscle', color: 'var(--spend)', def: 'To get money by working or helping.' },
    { term: 'Save', emoji: '🟢', label: 'green circle', color: 'var(--save)', def: 'To keep money for later instead of spending now.' },
    { term: 'Spend', emoji: '🔵', label: 'blue circle', color: 'var(--spend)', def: 'To use money to buy something.' },
    { term: 'Share', emoji: '🟡', label: 'yellow circle', color: '#c98f00', def: 'To give some money to help others.' },
    { term: 'Need', emoji: '🍎', label: 'apple', color: '#e05656', def: 'Something you must have to live, like food.' },
    { term: 'Want', emoji: '🧸', label: 'toy', color: '#e05656', def: 'Something fun you can live without.' },
    { term: 'Budget', emoji: '🗺️', label: 'map', color: '#f2b41c', def: 'A plan that gives every dollar a job.' },
    { term: 'Bank', emoji: '🏦', label: 'bank', color: 'var(--save)', def: 'A super-safe place that keeps your money.' },
    { term: 'Interest', emoji: '🌱', label: 'seedling', color: 'var(--save)', def: 'Extra money a bank adds to your savings.' },
    { term: 'Deposit', emoji: '⬇️', label: 'down arrow', color: 'var(--save)', def: 'Putting money INTO the bank.' },
    { term: 'Withdraw', emoji: '⬆️', label: 'up arrow', color: 'var(--spend)', def: 'Taking money OUT of the bank.' },
    { term: 'Goal', emoji: '🎯', label: 'target', color: 'var(--spend)', def: 'Something big you save up for.' },
    { term: 'Profit', emoji: '💰', label: 'money bag', color: '#f2b41c', def: 'The money left after paying your costs.' },
    { term: 'Cost', emoji: '🧾', label: 'receipt', color: '#e05656', def: 'What you must pay to make or get something.' },
    { term: 'Allowance', emoji: '🎁', label: 'gift', color: '#f2b41c', def: 'Money you get regularly, like every week.' },
    { term: 'Password', emoji: '🔑', label: 'key', color: '#e05656', def: 'A secret key. Never share it with anyone!' },
  ];

  function renderGlossary(app) {
    app.appendChild(el('h1', { html: emoji('📖', 'book') + ' Money Words in Pictures' }));
    app.appendChild(el('p', { class: 'subtitle', text: 'Every big money word, with a picture to remember it by. Tap the speaker to hear it!' }));
    const grid = el('div', { class: 'gloss-grid' });
    GLOSSARY.forEach((g) => {
      const card = el('div', { class: 'gloss-card' });
      card.style.setProperty('--gloss-color', g.color);
      card.innerHTML = '<span class="story-emoji" role="img" aria-label="' + g.label + '">' + g.emoji + '</span><h3>' + g.term + '</h3><p>' + g.def + '</p>';
      card.appendChild(readBtn(() => g.term + '. ' + g.def));
      grid.appendChild(card);
    });
    app.appendChild(grid);
  }

  /* ---------- router ---------- */
  function render() {
    if (window.__tick) { clearInterval(window.__tick); window.__tick = null; }
    const app = $('#app');
    app.innerHTML = '';
    stopClip();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    accrueBank();
    updateWallet();
    const hash = location.hash || '#/';
    const modMatch = hash.match(/^#\/module\/([\w-]+)/);
    const siteTitle = 'Penny’s Money Adventure';
    if (modMatch) {
      const mod = MODULES.find((m) => m.id === modMatch[1]);
      if (mod) { renderModule(app, mod); document.title = mod.title + ' · ' + siteTitle; return; }
    }
    if (hash.startsWith('#/bank')) { renderBank(app); document.title = 'Penny Bank · ' + siteTitle; return; }
    if (hash.startsWith('#/shop')) { renderShop(app); document.title = 'Penny Shop · ' + siteTitle; return; }
    if (hash.startsWith('#/kindness')) { renderKindness(app); document.title = 'Kindness Corner · ' + siteTitle; return; }
    if (hash.startsWith('#/quest')) { renderQuest(app); document.title = 'Money Master Quest · ' + siteTitle; return; }
    if (hash.startsWith('#/certificate')) { renderCertificate(app); document.title = 'Certificate · ' + siteTitle; return; }
    if (hash.startsWith('#/parents')) { renderParents(app); document.title = 'For Grown-Ups · ' + siteTitle; return; }
    if (hash.startsWith('#/glossary')) { renderGlossary(app); document.title = 'Money Words · ' + siteTitle; return; }
    renderHome(app);
    document.title = siteTitle;
  }

  /* ---------- header toggles ---------- */
  const FONT_KEY = 'penny-easyread';
  function applyFontPref() {
    let on = false;
    try { on = localStorage.getItem(FONT_KEY) === '1'; } catch (e) { /* ignore */ }
    document.body.classList.toggle('easy-read', on);
    $('#fontToggle').setAttribute('aria-pressed', String(on));
  }
  $('#fontToggle').addEventListener('click', () => {
    const on = !document.body.classList.contains('easy-read');
    try { localStorage.setItem(FONT_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
    applyFontPref();
  });

  function applySoundPref() {
    $('#soundToggle').setAttribute('aria-pressed', String(state.sound));
    $('#soundIcon').textContent = state.sound ? '🔊' : '🔇';
  }
  $('#soundToggle').addEventListener('click', () => {
    state.sound = !state.sound;
    save();
    applySoundPref();
    if (state.sound) sfx.pop();
  });

  /* ---------- service worker (offline / installable) ---------- */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable */ });
    });
  }

  /* ---------- boot ---------- */
  if ('speechSynthesis' in window) {
    loadVoices();                                   // often empty on first call…
    window.speechSynthesis.onvoiceschanged = loadVoices; // …so refresh when ready
  }
  window.addEventListener('hashchange', render);
  applyFontPref();
  applySoundPref();
  refreshHeaderPenny();
  updateHeaderJar();
  updateWallet();
  render();
})();
