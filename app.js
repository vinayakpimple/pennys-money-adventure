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

  /* ---------- progress (localStorage, no accounts) ---------- */
  const PROGRESS_KEY = 'penny-progress-v1';

  function getProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function markComplete(id) {
    const done = getProgress();
    if (!done.includes(id)) {
      done.push(id);
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(done)); } catch (e) { /* private mode */ }
    }
    updateHeaderJar();
  }

  function updateHeaderJar() {
    const done = getProgress().length;
    const total = MODULES.length;
    $('#jarFill').style.height = Math.round((done / total) * 100) + '%';
    $('#jarLabel').textContent = done + ' / ' + total;
  }

  /* ---------- read-aloud ---------- */
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  }

  function readBtn(getText) {
    return el('button', {
      class: 'read-btn',
      type: 'button',
      html: emoji('🔊', 'speaker') + ' Read to me',
      onclick: () => speak(getText()),
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
      parent: 'Introduces banks and compound growth visually: a slider moves time forward while savings (and a plant) grow.',
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
      parent: 'Teaches delayed gratification: choose a goal, simulate weekly saving, and experience progress toward a target.',
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
            setTimeout(() => btn.classList.remove('shake'), 450);
            return;
          }
          cheer.classList.remove('oops');
          btn.classList.add('open');
          btn.innerHTML = '<span class="story-emoji" role="img" aria-label="' + c.label + '">' + c.emoji + '</span><strong>' + c.num + '. ' + c.text + '</strong>';
          opened++;
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
            cheer.classList.remove('oops');
            cheer.textContent = placed === items.length ? 'All sorted — you are a Needs & Wants champ! 🏆' : 'Great sorting! ' + (items.length - placed) + ' to go ⭐';
            if (placed === items.length) onDone();
          } else {
            cheer.classList.add('oops');
            cheer.textContent = 'Hmm, try the other basket! Think: can you live without it? 🤔';
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
          cheer.textContent = 'Your $10 more than DOUBLED without any work. That is the magic of interest! ✨';
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
        const pct = Math.round((saved / picked.price) * 100);
        fill.style.width = pct + '%';
        fill.textContent = '$' + saved;
        if (saved >= picked.price) {
          finished = true;
          saveBtn.disabled = true;
          status.innerHTML = '<span class="grow-amt">GOAL REACHED in ' + weeks + ' weeks!</span> Enjoy your ' + picked.name + ' ' + picked.emoji + ' — you EARNED it!';
          cheer.textContent = 'That waiting superpower is called patience — and it just paid off! 🏆';
          confetti();
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
     VIEWS
     ================================================================ */
  const PENNY_SVG = $('.penny').outerHTML;

  function renderHome(app) {
    const done = getProgress();
    const hero = el('section', { class: 'hero' });
    hero.innerHTML = PENNY_SVG +
      '<div class="speech-bubble">Hi, I’m <strong>Penny</strong>! ' + emoji('👋', 'waving hand') +
      ' Pick a spot on the adventure map and let’s learn about money — with games, not boring words!</div>';

    const readAll = readBtn(() => 'Hi, I’m Penny! Pick a spot on the adventure map and let’s learn about money, with games, not boring words!');
    hero.appendChild(readAll);
    app.appendChild(hero);

    app.appendChild(el('div', {
      class: 'legend',
      html: 'Money colors: <span class="l-save">' + emoji('🟢', 'green') + ' Save</span><span class="l-spend">' + emoji('🔵', 'blue') + ' Spend</span><span class="l-share">' + emoji('🟡', 'yellow') + ' Share</span>',
    }));

    const map = el('ul', { class: 'map', 'aria-label': 'Adventure map of money lessons' });
    MODULES.forEach((m, i) => {
      const li = el('li', { class: 'map-node' });
      li.style.setProperty('--node-color', m.color);
      li.innerHTML =
        '<span class="level-num" aria-hidden="true">' + (i + 1) + '</span>' +
        (done.includes(m.id) ? '<span class="badge-star" role="img" aria-label="completed">🌟</span>' : '') +
        '<a class="map-link" href="#/module/' + m.id + '">' +
        '<span class="map-emoji" role="img" aria-label="' + m.title + '">' + m.emoji + '</span>' +
        '<span class="map-title">' + m.title + '</span>' +
        '<span class="map-tagline">' + m.tagline + '</span></a>';
      map.appendChild(li);
    });
    app.appendChild(map);
  }

  function renderModule(app, mod) {
    let step = 0; // 0 intro, 1 activity, 2 recap
    const stepNames = ['Watch', 'Play', 'Collect'];

    function draw() {
      app.innerHTML = '';
      app.style.setProperty('--node-color', mod.color);

      const head = el('div', { class: 'lesson-head' });
      head.appendChild(el('p', { class: 'crumbs', html: '<a href="#/">' + emoji('🗺️', 'map') + ' Back to map</a>' }));
      const dots = el('div', { class: 'steps-dots', 'aria-label': 'Step ' + (step + 1) + ' of 3: ' + stepNames[step] });
      for (let i = 0; i < 3; i++) dots.appendChild(el('span', { class: 'dot' + (i === step ? ' on' : '') }));
      head.appendChild(dots);
      app.appendChild(head);

      const card = el('section', { class: 'lesson-card' });
      card.style.setProperty('--node-color', mod.color);
      card.appendChild(el('h1', { html: emoji(mod.emoji, mod.title) + ' ' + mod.title }));

      const bubbleWrap = el('div', { class: 'hero', style: 'box-shadow:none;padding:10px 0;margin-bottom:6px;background:transparent;' });
      bubbleWrap.innerHTML = PENNY_SVG.replace('class="penny"', 'class="penny" style="width:70px;height:58px;"') +
        '<div class="speech-bubble">' + mod.bubble + '</div>';
      card.appendChild(bubbleWrap);

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
        next.innerHTML = 'Collect my stickers! ' + emoji('🌟', 'star');
        next.disabled = true;
        const activity = ACTIVITIES[mod.activity](() => {
          next.disabled = false;
          next.classList.add('green');
        });
        card.appendChild(activity);
        next.addEventListener('click', () => { step = 2; draw(); });
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
        const already = getProgress().includes(mod.id);
        next.classList.add('gold');
        next.innerHTML = (already ? 'Badge collected! Back to the map ' : 'Collect my badge! ') + emoji('🏅', 'badge');
        next.addEventListener('click', () => {
          if (!getProgress().includes(mod.id)) {
            markComplete(mod.id);
            confetti();
            next.innerHTML = 'Badge collected! Back to the map ' + emoji('🗺️', 'map');
            card.appendChild(el('p', { class: 'badge-earned', html: emoji('🏅', 'badge') + ' New badge earned: ' + mod.title + '!' }));
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

  function renderParents(app) {
    app.appendChild(el('h1', { html: emoji('🧑‍🏫', 'teacher') + ' For Grown-Ups' }));
    app.appendChild(el('p', {
      class: 'subtitle',
      text: 'Penny’s Money Adventure teaches personal finance to kids ages 7–12, designed visual-first for visual learners. Everything runs in the browser: no accounts, no ads, no data collection, and no real money anywhere. Progress is stored only on this device.',
    }));
    MODULES.forEach((m, i) => {
      const card = el('div', { class: 'info-card' });
      card.innerHTML = '<h3>' + emoji(m.emoji, m.title) + ' ' + (i + 1) + '. ' + m.title + '</h3><p>' + m.parent + '</p>';
      app.appendChild(card);
    });
    const tips = el('div', { class: 'info-card' });
    tips.innerHTML = '<h3>' + emoji('💡', 'light bulb') + ' Tips for the real world</h3>' +
      '<p>Try the 3-jars system at home with real jars. Let kids handle small amounts of real money, make small mistakes safely, and talk openly about family spending choices. The “Read to me” buttons help pre-readers use the site independently.</p>';
    app.appendChild(tips);
  }

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
    { term: 'Goal', emoji: '🎯', label: 'target', color: 'var(--spend)', def: 'Something big you save up for.' },
    { term: 'Profit', emoji: '💰', label: 'money bag', color: '#f2b41c', def: 'The money left after paying your costs.' },
    { term: 'Cost', emoji: '🧾', label: 'receipt', color: '#e05656', def: 'What you must pay to make or get something.' },
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
    const app = $('#app');
    app.innerHTML = '';
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const hash = location.hash || '#/';
    const modMatch = hash.match(/^#\/module\/([\w-]+)/);
    if (modMatch) {
      const mod = MODULES.find((m) => m.id === modMatch[1]);
      if (mod) { renderModule(app, mod); return; }
    }
    if (hash.startsWith('#/parents')) { renderParents(app); return; }
    if (hash.startsWith('#/glossary')) { renderGlossary(app); return; }
    renderHome(app);
  }

  /* ---------- easy-read font toggle ---------- */
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

  /* ---------- boot ---------- */
  window.addEventListener('hashchange', render);
  applyFontPref();
  updateHeaderJar();
  render();
})();
