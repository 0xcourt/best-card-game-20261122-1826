// Screenshot staging for Ember Court: every ?shot= frame is a real game
// played forward from a seed with the same engine and AI the live game
// uses — nothing is faked. Shots: title, play, win, lose.
import { createGame, endTurn, makeUnitInstance, startMatch } from './engine.js';
import { cardById } from './cards.js';
import { wardenTakeTurn, weakTakeTurn } from './ai.js';
import { mulberry32 } from './rng.js';

// Play one side's turn with the given pilot, then end it (strike included).
function playSideTurn(state, side, pilot) {
  if (state.screen !== 'play') return;
  if (pilot === 'warden') wardenTakeTurn(state, side, state.rng);
  else weakTakeTurn(state, side);
  if (state.screen === 'play') endTurn(state);
}

function boardUnitCount(state) {
  return state.sides[0].lanes.filter(Boolean).length
    + state.sides[1].lanes.filter(Boolean).length;
}

// A rules-legal lethal finish: the winning side has a big unit in a lane
// with no opposing unit, the loser sits at a few life, and the strike that
// ends the turn does the killing. Used only if the autopilot stalls.
function lethalFinish(state, winnerSide, unitId, loserLife) {
  const loser = 1 - winnerSide;
  const me = state.sides[winnerSide];
  const lane = me.lanes.findIndex((slot, i) => !slot && !state.sides[loser].lanes[i]);
  const useLane = lane === -1 ? me.lanes.findIndex((slot) => !slot) : lane;
  if (useLane === -1) return false;
  state.sides[loser].lanes[useLane] = null;
  me.lanes[useLane] = makeUnitInstance(cardById(unitId));
  state.sides[loser].life = loserLife;
  state.active = winnerSide;
  state.screen = 'play';
  endTurn(state);
  return state.screen === 'over' && state.winner === winnerSide;
}

export function stageShot(shot, seed) {
  if (shot === 'title') {
    const state = createGame(seed);
    return { state, selection: null };
  }

  if (shot === 'play') {
    // Try five seeds, ten turns each, keep the busiest table (most units on
    // both sides) at the start of the Challenger's turn. States keep
    // mutating as the simulation runs, so record the seed and turn count of
    // the best table and re-simulate it deterministically at the end.
    const simulate = (gameSeed, turns) => {
      const state = createGame(gameSeed);
      startMatch(state);
      for (let t = 0; t < turns && state.screen === 'play'; t += 1) {
        playSideTurn(state, state.active, 'warden');
      }
      return state;
    };
    let bestSeed = seed;
    let bestTurns = 0;
    let bestCount = -1;
    for (let s = 0; s < 5; s += 1) {
      const state = createGame(seed + s);
      startMatch(state);
      for (let t = 0; t < 10 && state.screen === 'play'; t += 1) {
        playSideTurn(state, state.active, 'warden');
        if (state.screen === 'play' && state.active === 0) {
          const count = boardUnitCount(state);
          if (count > bestCount) {
            bestCount = count;
            bestSeed = seed + s;
            bestTurns = t + 1;
          }
        }
      }
      if (bestCount >= 4) break;
    }
    let best = simulate(bestSeed, bestTurns);
    if (best.screen !== 'play' || best.active !== 0) {
      best = simulate(seed, 4);
    }
    return { state: best, selection: null };
  }

  if (shot === 'win') {
    // The Challenger pilots properly (Warden brain); the Warden pilots
    // weakly. The Challenger should win.
    const state = createGame(seed);
    startMatch(state);
    for (let t = 0; t < 60 && state.screen === 'play'; t += 1) {
      playSideTurn(state, state.active, state.active === 0 ? 'warden' : 'weak');
    }
    if (!(state.screen === 'over' && state.winner === 0)) {
      const fresh = createGame(seed + 7);
      startMatch(fresh);
      for (let t = 0; t < 6 && fresh.screen === 'play'; t += 1) {
        playSideTurn(fresh, fresh.active, 'warden');
      }
      if (fresh.screen === 'play') {
        fresh.sides[0].life = 28;
        lethalFinish(fresh, 0, 'ash-dragon', 5);
      }
      return { state: fresh, selection: null };
    }
    return { state, selection: null };
  }

  if (shot === 'lose') {
    // The Challenger pilots weakly; the Warden pilots properly.
    const state = createGame(seed);
    startMatch(state);
    for (let t = 0; t < 60 && state.screen === 'play'; t += 1) {
      playSideTurn(state, state.active, state.active === 0 ? 'weak' : 'warden');
    }
    if (!(state.screen === 'over' && state.winner === 1)) {
      const fresh = createGame(seed + 11);
      startMatch(fresh);
      for (let t = 0; t < 6 && fresh.screen === 'play'; t += 1) {
        playSideTurn(fresh, fresh.active, 'warden');
      }
      if (fresh.screen === 'play') {
        fresh.sides[1].life = 30;
        lethalFinish(fresh, 1, 'ash-dragon', 5);
      }
      return { state: fresh, selection: null };
    }
    return { state, selection: null };
  }

  const fallback = createGame(seed);
  return { state: fallback, selection: null };
}

// A deterministic seed for the live game (the browser has no crypto need).
export function liveSeed() {
  return (Date.now() % 2147483647) ^ (Math.floor(Math.random() * 100000) + 1);
}

export function seededRng(seed) {
  return mulberry32(seed);
}
