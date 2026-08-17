# Penny’s Money Adventure — local fixes

Edits are only in this folder. Save key is still `penny-save-v2`. No PWA/audio wiring, no emoji card grid, town Penny stays `pointer-events: none`.

## XSS / kid name

`kidName()` / `state.name` were concatenated into `innerHTML` / `el(..., {html})`.

- Added `escapeHtml`.
- Town hello now uses a text node + `<strong>` via `textContent` (`hello.append(..., el("strong", { text: kidName() }), ...)`).
- Bank speech, quest speech, certificate name, and Grown-ups stats use `escapeHtml(kidName())`.
- Quest win heading already used `{ text: kidName() + ... }` (safe).

Onboarding as the literal name `Sam<b>X</b>ZZZZ` now shows those characters. It does not bold “SamX” or swallow `ZZZZ`.

## Landmark hit targets

L1 was `(27%, 87%)` and L2 `(22%, 78%)`, so `elementFromPoint` at L1’s center hit the Needs vs. Wants link (L2’s label box sat on top of L1).

- L1 → `(16%, 91%)`, L2 → `(30%, 72%)`.
- Landmark/building wrappers: `pointer-events: none`.
- Circular/square buttons stay `pointer-events: auto` and `z-index: 5`.
- Titles/tags/copy: `pointer-events: none` so captions cannot steal another landmark’s tap.
- Stacked trail (`max-width: 760px`) restores full-row clicks (no overlap there).
- `.town-penny` remains `pointer-events: none`.

A tap on landmark 1 opens What Is Money?, not lesson 2.

## Kindness “Give 5 coins”

Double-tap could charge 10. Each Give button now:

- returns immediately if a give is already in flight or the button is disabled
- disables all Give buttons for the duration of a successful give
- re-enables them only if the wallet still has ≥ 5 coins

## 390px header

- Tagline “A picture-book money game” is hidden below 640px.
- Topbar wraps; below 480px the brand is a full row and tools (wallet, Words, Grown-ups, toggles) wrap on the next row.
- Title ellipsizes inside the brand; it no longer paints through the nav.

## Nits

- Bank withdraw amounts are `Math.floor`’d, and the persisted `state.bank.balance` is `Math.floor`’d after withdraw so leftover `0.000224…` interest dust is not saved.
- Sequential hash lock (`#/module/<id>` when prior lessons are undone) was **skipped**. `lessonState` already paints later landmarks locked, but every lesson route stays open — same as the original “all lessons always open” design. Blocking the hash would fight that.

## Verify

```
rg -n "kidName|innerHTML|Give 5|pos: \{ x:" /workspace/pennys-10x/app.js
```
