[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/0xcourt/best-card-game-20261122-1826/rank.svg)](https://make.fun/c/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/0xcourt/best-card-game-20261122-1826/reward.svg)](https://make.fun/c/best-card-game-20261122-1826)

# Ember Court — Duel of the Four Suits

An original tactical card duel for the [make.fun best card game bounty](https://make.fun/c/best-card-game-20261122-1826). You are the Challenger; the Warden of the Court guards the four suits. Play units into three lanes — Cinder, Tide and Thorn — and at the end of your turn they strike. Break the Warden's guard and take all 30 of their life before they take yours.

- **20 unique cards** across four suits (Ember ▲, Tide ≈, Thorn ✦, Stone ◆), each suit told apart by colour *and* glyph: 13 units with Ward and Battlecry effects, 7 spells that burn, heal, rally, draw and quake.
- **Real decisions every hand**: energy grows +1 a turn to a max of 10, a 30-card deck, a 7-card hand, fatigue when the deck runs dry, and lanes that trade blows simultaneously — a survivor strikes the hero.
- **A readable opponent**: the Warden is a heuristic AI that values lanes, lethal, Ward and removal, so its choices can be read and countered.
- **Complete game**: title screen, a table with both hands (the Warden's face-down), readable costs / attack / health, both life totals, a log of events, and win and lose screens.
- **Original art and sound**: all visuals are CSS gradients and glyphs; all sound is synthesised WebAudio. No network, no external assets, no build step.

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Mouse: click a card, then a lane (units) or a target (spells). Keys: `1–7` select a hand card, `Enter` ends the turn, `Esc` cancels a selection.

## Files

- `game/` — the playable game as static files (`index.html`, `style.css`, `src/`)
  - `src/rng.js` — seeded generator, shuffle, pick-int
  - `src/cards.js` — the four suits, the 20-card pool, the 30-card deck builder
  - `src/engine.js` — pure rules: draw, fatigue, Ward, Battlecry, strike phase, win/lose
  - `src/ai.js` — the Warden heuristic and the weak pilot used for staging
  - `src/audio.js` — synthesised WebAudio effects
  - `src/render.js` — the table, card faces, overlays
  - `src/shots.js` — deterministic screenshot staging from real games
  - `src/main.js` — boot, input, live mode and shot mode
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — four real renders of the game's own code
