# Penny's Money Adventure 🐷

A kids' personal finance educational website (ages 7–12) built visual-first
for visual learners. Built from the goal-oriented prompt in
[`PROMPT.md`](PROMPT.md).

**Live site:** https://vinayakpimple.github.io/pennys-money-adventure/
(auto-deployed from `main` by GitHub Actions)

**To run locally:** open `index.html` in any browser. No build step, no
server, no accounts, no ads, no data collection — progress is stored in
`localStorage` on the device only.

## What's new in v3 — evidence-based upgrades

Informed by a deep review of the research on children's financial education
(Kaiser & Menkhoff 2020 and Kaiser/Lusardi/Menkhoff/Urban 2022 meta-analyses
of 76+ RCTs; the CFPB "building blocks" framework; Whitebread & Bingham 2013,
Cambridge). The evidence: lessons reliably raise *knowledge* but only weakly
change *behavior*, and guided "learning by doing" plus reflection is what
narrows that gap. So v3 adds:

- **Reflection step** on every lesson (Watch → Play → **Think** → Collect):
  the child applies each idea to their *own* choices and gets warm feedback —
  the guided-reflection the evidence says turns doing into learning. Never scored.
- **Kindness Corner**: give coins to help causes, rewarded only by a growing
  flower garden and gratitude — **deliberately never repaid in coins or badges**,
  to avoid the over-justification effect (paying for generosity crowds it out).
- **Daily Challenge**: one recall question from a past lesson each day, to fight
  the knowledge decay the research documents (spaced retention).
- **Real-money parent kit**: conversation scripts and a printable "Family Money
  Night" (real 3 jars + allowance) — because families are the primary driver of
  real behavior change, the app's biggest lever.

## What's new in v2 — the living money world

- **Penny Coins economy**: every activity pays coins (+10 first clear, +2 replays,
  +5 per badge, +5 daily allowance) into a persistent wallet
- **Penny Bank**: deposit coins and earn **1% interest per real hour**, compounding
  while away — kids return the next day and *see* compound growth happen
- **Penny Shop**: buy accessories Penny actually wears site-wide; big-ticket items
  double as genuine savings goals
- **Money Master Quest**: a 10-question final boss unlocked by all 9 badges,
  with a **printable Certificate of Money Mastery**
- **Name + avatar**: Penny greets each adventurer personally
- **Sound effects**: synthesized coin clinks and fanfares (WebAudio, mutable)
- **Installable PWA**: add to home screen on tablets; works fully offline

## What's inside

- **Penny the piggy bank mascot** guides every page with speech bubbles
- **9 interactive lessons**, each following *watch → play → collect*:
  1. What Is Money? — tap-to-reveal history timeline
  2. Needs vs. Wants — sorting game with instant feedback
  3. Earning Money — chore board that fills a piggy bank
  4. The 3 Jars — drop 10 coins into Save/Spend/Share jars
  5. Make a Budget — sliders + live icon chart until every dollar has a job
  6. The Money Garden — slide time forward, watch interest grow a plant and coin stack
  7. Super Saver Goals — pick a dream, save week by week (delayed gratification)
  8. Lemonade Boss — pick a price, see costs, demand, and profit
  9. Money Safety Shield — flip cards on digital money safety
- **Site-wide color code:** green = save, blue = spend, yellow = share
- **Progress badges** on the adventure map plus a filling jar in the header
- **"Read to me" buttons** (Web Speech API) for pre- and early readers
- **Easy-read font toggle**, keyboard-operable activities, ARIA labels,
  reduced-motion support
- **Grown-ups page** summarizing what each module teaches
- **Visual glossary** pairing every money word with a picture
