// The Warden of the Court: a heuristic AI, deterministic given the seeded
// generator, with a small random jitter. It scores every playable card each
// step and plays the best while any action scores above the threshold, then
// ends its turn. `side` is a parameter — the same brain pilots either seat,
// which is how the play shot stages busy tables and the win shot is staged.
//
// Also here: the weak pilot, a deliberately feeble player who only drops the
// first affordable unit into the first open lane and never casts a spell.
// It exists only to stage the lose screenshot.
import { jitter } from './rng.js';
import { needsTarget, playCard, validTargets } from './engine.js';

export const PLAY_THRESHOLD = 1.5;

// Every legal action for `side` right now: { handIndex, card, lane, target }.
export function listActions(state, side) {
  const me = state.sides[side];
  const actions = [];
  me.hand.forEach((card, handIndex) => {
    if (card.cost > me.energy) return;
    if (card.type === 'unit') {
      for (let lane = 0; lane < 3; lane += 1) {
        if (!me.lanes[lane]) actions.push({ handIndex, card, lane, target: null });
      }
    } else if (needsTarget(card)) {
      for (const target of validTargets(state, side, card)) {
        actions.push({ handIndex, card, lane: null, target });
      }
    } else {
      actions.push({ handIndex, card, lane: null, target: null });
    }
  });
  return actions;
}

function wouldKill(unit, damage) {
  if (!unit) return false;
  if (unit.ward) return false;
  return damage >= unit.health;
}

function scoreUnit(state, side, action) {
  const card = action.card;
  const foe = 1 - side;
  let score = card.attack * 1.3 + card.health - card.cost * 0.9;
  const opposing = state.sides[foe].lanes[action.lane];
  if (!opposing) {
    // Empty lane: direct hero damage at end of turn, so the bonus scales
    // with the attack that will actually land.
    score += 1 + card.attack * 0.8;
  } else {
    // Blocking value: a unit in this lane forces the opposing unit to
    // trade instead of hitting our hero, denying its attack this strike.
    score += opposing.attack * 0.4;
    if (wouldKill(opposing, card.attack)) {
      // Removes a threat — worth more the harder it hit — and the lane
      // is then open. Bonus when our unit also survives the trade: it
      // strikes the hero.
      score += 2.5 + opposing.attack * 0.3;
      if (card.health > opposing.attack) score += 1.5;
    }
    // Penalty when the opposing unit would kill it for free: it survives
    // our blow (health or ward) and its attack finishes us.
    const survives = opposing.ward || opposing.health > card.attack;
    if (survives && opposing.attack >= card.health) score -= 3;
  }
  if (card.ward) score += 0.75;
  if (card.battlecry === 'draw1') score += 0.8;
  if (card.battlecry === 'heal3' && state.sides[side].life <= 24) score += 1;
  if (card.battlecry === 'heal5' && state.sides[side].life <= 24) score += 1.5;
  return score;
}

function scoreSpell(state, side, action) {
  const card = action.card;
  const foe = 1 - side;
  const enemyUnits = state.sides[foe].lanes.filter(Boolean);
  const target = action.target;

  if (card.spell === 'emberbolt') {
    if (target && target.kind === 'hero') {
      if (3 >= state.sides[foe].life) return 100; // lethal
      return -10; // never burn the bolt on a healthy hero
    }
    const unit = target ? state.sides[target.side].lanes[target.lane] : null;
    if (!unit) return -10;
    if (unit.attack < 3) return -10; // never wasted on a weak unit
    if (!wouldKill(unit, 3)) return -10; // ... it cannot kill
    // Removal is premium: it denies the unit's attack every turn it would
    // have lived, and frees the lane.
    return 5 + unit.attack * 0.8;
  }
  if (card.spell === 'frostbind') {
    const unit = target ? state.sides[target.side].lanes[target.lane] : null;
    if (!unit) return -10;
    if (unit.attack < 3) return -10;
    if (!wouldKill(unit, 2)) return -10;
    return 4 + unit.attack * 0.8 + 1; // +1: it also draws a card
  }
  if (card.spell === 'wildfire' || card.spell === 'quake') {
    const damage = card.spell === 'wildfire' ? 2 : 4;
    const deaths = enemyUnits.filter((u) => wouldKill(u, damage)).length;
    if (deaths >= 2) return 5 + deaths * 1.5;
    if (enemyUnits.length >= 3) return 2.5;
    return -10;
  }
  if (card.spell === 'mend') {
    if (state.sides[side].life > 18) return -10;
    return 4 + (18 - state.sides[side].life) * 0.2;
  }
  if (card.spell === 'rally') {
    const unit = target ? state.sides[target.side].lanes[target.lane] : null;
    if (!unit) return -10;
    const strongest = Math.max(...state.sides[side].lanes.filter(Boolean).map((u) => u.attack), 0);
    if (unit.attack < strongest) return -10; // only on the strongest unit
    return 3.5 + unit.attack * 0.3;
  }
  if (card.spell === 'insight') {
    if (state.sides[side].hand.length > 4) return -10;
    return 3.5;
  }
  return -10;
}

export function scoreAction(state, side, action, rng) {
  const base = action.card.type === 'unit'
    ? scoreUnit(state, side, action)
    : scoreSpell(state, side, action);
  return base + jitter(rng, 0.4);
}

// Play the Warden's whole turn: keep playing the best-scoring action while
// any scores above the threshold. Returns the actions taken. Does NOT end
// the turn — the caller does that (strike happens on endTurn).
export function wardenTakeTurn(state, side, rng) {
  const taken = [];
  for (let step = 0; step < 20; step += 1) {
    if (state.screen !== 'play') break;
    const actions = listActions(state, side);
    if (actions.length === 0) break;
    let best = null;
    let bestScore = PLAY_THRESHOLD;
    for (const action of actions) {
      const score = scoreAction(state, side, action, rng);
      if (score > bestScore) {
        bestScore = score;
        best = action;
      }
    }
    if (!best) break;
    const result = playCard(state, side, best.handIndex, best.lane, best.target);
    if (!result.ok) break;
    taken.push(best);
  }
  return taken;
}

// The weak pilot: the first affordable unit into the first open lane, one
// card a turn, spells ignored. Used to stage the lose screenshot (weak
// Challenger) and the win screenshot (weak Warden).
export function weakTakeTurn(state, side) {
  if (state.screen !== 'play') return [];
  const me = state.sides[side];
  const handIndex = me.hand.findIndex((c) => c.type === 'unit' && c.cost <= me.energy);
  if (handIndex === -1) return [];
  const lane = me.lanes.findIndex((slot) => !slot);
  if (lane === -1) return [];
  const result = playCard(state, side, handIndex, lane, null);
  if (!result.ok) return [];
  return [{ handIndex, lane }];
}
