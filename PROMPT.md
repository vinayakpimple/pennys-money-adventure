# Prompt for Fable: Kids Personal Finance Educational Website

Design and build a complete, ready-to-use educational website that teaches
kids personal finance — built around one core principle: **every concept is
taught visually first, with text as backup, not the other way around.**

## Audience

- Primary: kids ages 7–12 (consider two visual tracks — "Explorers" for
  ages 7–9 and "Builders" for ages 10–12 — if content depth needs to differ)
- Secondary: parents/teachers who want a quick plain-language overview of
  what each module teaches

## Success Criteria

Treat this as done when:

- A child with limited reading ability can understand each concept from
  the visuals alone, without relying on paragraphs of text
- Every core topic below has at least one interactive visual: a game,
  simulation, drag-and-drop activity, or animated chart
- Kids can see their own progress visually (badges, levels, or a filling
  jar/map) without needing to log in
- The site is fully client-side (HTML/CSS/JS, no build step, no backend,
  no login, no ads, no data collection) and works on tablets and desktops
- A parent could hand a child the page and walk away

## Core Topics to Teach

1. What money is and where it comes from
2. Needs vs. wants
3. Earning money (chores, allowance, small jobs)
4. Saving, spending, and sharing/giving — a "3 jars" model
5. Budgeting basics
6. How banks and savings accounts work; how interest/savings grow over time
7. Goal-setting and delayed gratification (e.g., saving toward a toy)
8. Basic entrepreneurship (run a lemonade stand: costs, price, profit)
9. Safe, smart habits around digital money (age-appropriate, no real
   transactions)

## Visual-Learning Requirements (the core differentiator)

- Open every lesson with an illustration, animated infographic, or short
  visual story — never lead with a paragraph
- Use a consistent, friendly mascot/character to guide navigation and
  narrate concepts
- Make abstract ideas concrete: coins filling a jar for saving, an
  icon-based bar/pie chart (not raw numbers) for budgeting, a growing
  plant or stacking blocks for compound interest over time
- Color-code money concepts consistently site-wide (e.g., green = save,
  blue = spend, yellow = share) and reuse those colors in every module
- Prefer drag-and-drop, sliders, click-to-reveal, and simple games over
  text-based quizzes
- Add lightweight motion and feedback: coins animate when a savings goal
  is reached, jars fill up, confetti plays on finishing a module
- Keep on-screen text minimal — large font, short sentences, no jargon —
  and pair any necessary text with an icon or image
- Include a read-aloud/narration toggle for pre- and early readers

## Site Structure

- Landing page: mascot welcome plus a visual "map" of learning modules,
  like a game-board level-select screen
- One section per core topic, each following: intro animation →
  interactive activity/game → a short visual recap ("sticker" summary)
- A progress tracker (badges, stars, or a filling jar) persisted via
  localStorage, visible across the site
- A simple parent/teacher page summarizing what each module teaches, in
  plain language
- A visual glossary pairing key terms with icons/illustrations rather
  than dictionary-style definitions

## Tone & Constraints

- Encouraging and empowering — never preachy or anxiety-inducing about
  money
- No ads, no real payment forms, no personal data collection, no external
  account linking — this is a learning simulation only
- Simple vocabulary and short sentences appropriate for ages 7–12
- Accessible: alt text on all visuals, sufficient color contrast,
  keyboard-navigable interactions, and a dyslexia-friendly font option

## Deliverable

A complete, working, responsive website (HTML/CSS/JS) implementing the
structure and requirements above, ready to open directly in a browser.
