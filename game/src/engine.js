// Pure rules of Ember Court: no DOM, no sound, no AI. A game state is a
// plain object; every function below takes the state and mutates it, logging
// each event into state.log so the table can show what just happened.
//
// Sides: 0 is the Challenger (the player), 1 is the Warden of the Court.
// A side holds life, a deck of card ids, a hand of live card instances,
// energy, a fatigue counter and three lane slots (one unit each, or null).
import { buildDeck, cardById } from './cards.js';
import { mulberry32, shuffle } from './rng.js';

export const MAX_LIFE = 30;
export const MAX_HAND = 7;
export const MAX_ENERGY = 10;
export const MAX_TURNS = 200;

let nextUid = 1;

export function makeUnitInstance(def) {
  return {
    uid: nextUid,
    defId: def.id,
    name: def.name,
    cost: def.cost,
    suit: def.suit,
    type: 'unit',
    attack: def.attack,
    health: def.health,
    maxHealth: def.health,
    ward: Boolean(def.ward),
    battlecry: def.battlecry || null,
    text: def.text,
  };
}

export function makeSpellInstance(def) {
  return {
    uid: nextUid,
    defId: def.id,
    name: def.name,
    cost: def.cost,
    suit: def.suit,
    type: 'spell',
    spell: def.spell,
    target: def.target,
    text: def.text,
  };
}

export function makeCardInstance(def) {
  nextUid += 1;
  return def.type === 'unit' ? makeUnitInstance(def) : makeSpellInstance(def);
}

function makeSide() {
  return {
    life: MAX_LIFE,
    deck: [],
    hand: [],
    energy: 0,
    maxEnergy: 0,
    fatigue: 0,
    lanes: [null, null, null],
    cardsPlayed: 0,
  };
}

export function sideName(side) {
  return side === 0 ? 'You' : 'Warden';
}

export function logEvent(state, text) {
  state.log.push(text);
  if (state.log.length > 40) state.log.splice(0, state.log.length - 40);
}

// A fresh duel. The Challenger draws 5, the Warden draws 6 (catch-up for
// going second). The Challenger starts with 1 energy.
export function createGame(seed) {
  const rng = mulberry32(seed);
  const state = {
    seed,
    rng,
    turn: 1,
    active: 0,
    screen: 'title',
    winner: null,
    log: [],
    sides: [makeSide(), makeSide()],
  };
  for (const side of state.sides) {
    side.deck = shuffle(buildDeck(), rng).map((id) => makeCardInstance(cardById(id)));
  }
  for (let i = 0; i < 5; i += 1) drawCard(state, 0);
  for (let i = 0; i < 6; i += 1) drawCard(state, 1);
  state.sides[0].maxEnergy = 1;
  state.sides[0].energy = 1;
  logEvent(state, 'Welcome to the Ember Court.');
  return state;
}

export function startMatch(state) {
  state.screen = 'play';
  logEvent(state, 'Your turn — turn 1.');
}

// Draw one card; an empty deck deals fatigue that grows by 1 each time.
export function drawCard(state, side) {
  const me = state.sides[side];
  if (me.deck.length === 0) {
    me.fatigue += 1;
    damageHero(state, side, me.fatigue, 'fatigue');
    return null;
  }
  const card = me.deck.pop();
  if (me.hand.length >= MAX_HAND) {
    logEvent(state, `${sideName(side)} drew ${card.name} but the hand was full — it burns.`);
    return null;
  }
  me.hand.push(card);
  return card;
}

export function damageHero(state, side, amount, cause) {
  const me = state.sides[side];
  me.life = Math.max(0, me.life - amount);
  if (cause === 'fatigue') {
    logEvent(state, `${sideName(side)} take ${amount} fatigue damage.`);
  } else if (cause === 'strike') {
    logEvent(state, `${sideName(side)} take ${amount} damage.`);
  }
  checkEnd(state);
}

export function healHero(state, side, amount) {
  const me = state.sides[side];
  const before = me.life;
  me.life = Math.min(MAX_LIFE, me.life + amount);
  const healed = me.life - before;
  if (healed > 0) logEvent(state, `${sideName(side)} restore ${healed} life.`);
}

// Damage a lane unit. Ward ignores the first hit entirely, then is gone.
export function damageUnit(state, side, lane, amount) {
  const unit = state.sides[side].lanes[lane];
  if (!unit) return;
  if (unit.ward) {
    unit.ward = false;
    logEvent(state, `${unit.name}'s ward shatters the blow.`);
    return;
  }
  unit.health -= amount;
  logEvent(state, `${unit.name} takes ${amount} damage.`);
  if (unit.health <= 0) {
    state.sides[side].lanes[lane] = null;
    logEvent(state, `${unit.name} is destroyed.`);
  }
}

function resolveBattlecry(state, side, unit) {
  if (unit.battlecry === 'draw1') {
    const drawn = drawCard(state, side);
    if (drawn) logEvent(state, `${unit.name} draws a card.`);
  } else if (unit.battlecry === 'heal3') {
    healHero(state, side, 3);
  } else if (unit.battlecry === 'heal5') {
    healHero(state, side, 5);
  }
}

// Targets: { kind: 'unit', side, lane } | { kind: 'hero', side } | null.
export function validTargets(state, side, card) {
  const foe = 1 - side;
  if (card.target === 'any') {
    const targets = [{ kind: 'hero', side: foe }];
    for (let lane = 0; lane < 3; lane += 1) {
      if (state.sides[foe].lanes[lane]) targets.push({ kind: 'unit', side: foe, lane });
    }
    return targets;
  }
  if (card.target === 'enemyUnit') {
    const targets = [];
    for (let lane = 0; lane < 3; lane += 1) {
      if (state.sides[foe].lanes[lane]) targets.push({ kind: 'unit', side: foe, lane });
    }
    return targets;
  }
  if (card.target === 'friendlyUnit') {
    const targets = [];
    for (let lane = 0; lane < 3; lane += 1) {
      if (state.sides[side].lanes[lane]) targets.push({ kind: 'unit', side, lane });
    }
    return targets;
  }
  return [];
}

export function needsTarget(card) {
  return card.target === 'any' || card.target === 'enemyUnit' || card.target === 'friendlyUnit';
}

function applySpell(state, side, card, target) {
  const foe = 1 - side;
  if (card.spell === 'emberbolt') {
    if (target && target.kind === 'hero') {
      damageHero(state, foe, 3, 'spell');
      logEvent(state, `Emberbolt scorches the ${foe === 1 ? 'Warden' : 'Challenger'} for 3.`);
    } else if (target && target.kind === 'unit') {
      damageUnit(state, target.side, target.lane, 3);
    }
  } else if (card.spell === 'wildfire') {
    for (let lane = 0; lane < 3; lane += 1) {
      if (state.sides[foe].lanes[lane]) damageUnit(state, foe, lane, 2);
    }
    logEvent(state, 'Wildfire sweeps the enemy lanes.');
  } else if (card.spell === 'mend') {
    healHero(state, side, 6);
  } else if (card.spell === 'rally') {
    if (target && target.kind === 'unit') {
      const unit = state.sides[target.side].lanes[target.lane];
      if (unit) {
        unit.attack += 2;
        unit.health += 2;
        unit.maxHealth += 2;
        logEvent(state, `${unit.name} rallies to ${unit.attack}/${unit.health}.`);
      }
    }
  } else if (card.spell === 'insight') {
    drawCard(state, side);
    drawCard(state, side);
    logEvent(state, `${sideName(side)} draw 2 cards.`);
  } else if (card.spell === 'frostbind') {
    if (target && target.kind === 'unit') damageUnit(state, target.side, target.lane, 2);
    drawCard(state, side);
    logEvent(state, 'Frostbind chills a unit and draws a card.');
  } else if (card.spell === 'quake') {
    for (let lane = 0; lane < 3; lane += 1) {
      if (state.sides[foe].lanes[lane]) damageUnit(state, foe, lane, 4);
    }
    logEvent(state, 'The court quakes — 4 damage to all enemy units.');
  }
}

// Play a hand card. Units need a free lane on the player's own side;
// targeted spells need a target object; instant spells need neither.
// Returns { ok: true } or { ok: false, error }.
export function playCard(state, side, handIndex, laneIndex, target) {
  if (state.screen !== 'play') return { ok: false, error: 'the duel is not in play' };
  if (state.active !== side) return { ok: false, error: 'it is not your turn' };
  const me = state.sides[side];
  const card = me.hand[handIndex];
  if (!card) return { ok: false, error: 'no such card' };
  if (card.cost > me.energy) return { ok: false, error: 'not enough energy' };

  if (card.type === 'unit') {
    if (laneIndex === null || laneIndex === undefined) return { ok: false, error: 'choose a lane' };
    if (laneIndex < 0 || laneIndex > 2) return { ok: false, error: 'no such lane' };
    if (me.lanes[laneIndex]) return { ok: false, error: 'that lane is occupied' };
    me.hand.splice(handIndex, 1);
    me.energy -= card.cost;
    me.cardsPlayed += 1;
    me.lanes[laneIndex] = card;
    logEvent(state, `${sideName(side)} play ${card.name}.`);
    resolveBattlecry(state, side, card);
  } else {
    if (needsTarget(card) && !target) return { ok: false, error: 'choose a target' };
    me.hand.splice(handIndex, 1);
    me.energy -= card.cost;
    me.cardsPlayed += 1;
    logEvent(state, `${sideName(side)} cast ${card.name}.`);
    applySpell(state, side, card, target);
  }
  checkEnd(state);
  return { ok: true };
}

// End of a side's turn: its units strike, lane by lane. Both units in a
// lane trade blows at once; a survivor whose foe died then hits the enemy
// hero; a lone unit with no opposing unit hits the hero directly.
export function strikePhase(state, side) {
  const foe = 1 - side;
  const attacker = state.sides[side];
  const defender = state.sides[foe];
  for (let lane = 0; lane < 3; lane += 1) {
    const mine = attacker.lanes[lane];
    const theirs = defender.lanes[lane];
    if (!mine) continue;
    if (theirs) {
      const myAttack = mine.attack;
      const theirAttack = theirs.attack;
      // Simultaneous trade: ward can absorb on either side.
      if (mine.ward) {
        mine.ward = false;
        logEvent(state, `${mine.name}'s ward shatters the blow.`);
      } else {
        mine.health -= theirAttack;
      }
      if (theirs.ward) {
        theirs.ward = false;
        logEvent(state, `${theirs.name}'s ward shatters the blow.`);
      } else {
        theirs.health -= myAttack;
      }
      if (mine.health <= 0) {
        attacker.lanes[lane] = null;
        logEvent(state, `${mine.name} is destroyed.`);
      }
      if (theirs.health <= 0) {
        defender.lanes[lane] = null;
        logEvent(state, `${theirs.name} is destroyed.`);
      }
      const survivor = attacker.lanes[lane];
      if (survivor && !defender.lanes[lane]) {
        logEvent(state, `${survivor.name} hits the hero for ${survivor.attack}.`);
        damageHero(state, foe, survivor.attack, 'strike');
      }
    } else {
      logEvent(state, `${mine.name} hits the hero for ${mine.attack}.`);
      damageHero(state, foe, mine.attack, 'strike');
    }
    if (state.screen === 'over') return;
  }
}

// Begin a side's turn: +1 max energy (cap 10), refill, draw a card.
export function beginTurn(state, side) {
  const me = state.sides[side];
  me.maxEnergy = Math.min(MAX_ENERGY, me.maxEnergy + 1);
  me.energy = me.maxEnergy;
  drawCard(state, side);
  if (state.screen !== 'over') {
    logEvent(state, `${side === 0 ? 'Your turn' : "Warden's turn"} — turn ${state.turn}.`);
  }
}

// End the active side's turn: strike, then hand over to the other side.
export function endTurn(state) {
  if (state.screen !== 'play') return { ok: false, error: 'the duel is not in play' };
  const side = state.active;
  strikePhase(state, side);
  if (state.screen === 'over') return { ok: true };
  state.active = 1 - side;
  state.turn += 1;
  beginTurn(state, state.active);
  return { ok: true };
}

export function checkEnd(state) {
  if (state.screen === 'over') return;
  const a = state.sides[0].life;
  const b = state.sides[1].life;
  if (a <= 0 && b <= 0) {
    state.winner = 0;
    state.screen = 'over';
    logEvent(state, 'Both heroes fall — the Challenger takes the court.');
  } else if (b <= 0) {
    state.winner = 0;
    state.screen = 'over';
    logEvent(state, 'The Warden falls. The court is yours.');
  } else if (a <= 0) {
    state.winner = 1;
    state.screen = 'over';
    logEvent(state, 'The Challenger falls. The Warden prevails.');
  }
}

// Invariants the tests assert after every action.
export function checkInvariants(state) {
  const problems = [];
  for (let s = 0; s < 2; s += 1) {
    const me = state.sides[s];
    if (me.hand.length > MAX_HAND) problems.push(`side ${s} hand ${me.hand.length}`);
    if (me.energy < 0 || me.energy > MAX_ENERGY) problems.push(`side ${s} energy ${me.energy}`);
    if (me.maxEnergy < 0 || me.maxEnergy > MAX_ENERGY) problems.push(`side ${s} maxEnergy ${me.maxEnergy}`);
    if (me.life < 0 || me.life > MAX_LIFE) problems.push(`side ${s} life ${me.life}`);
    if (me.deck.length < 0) problems.push(`side ${s} negative deck`);
  }
  if (state.turn > MAX_TURNS + 1) problems.push(`turn ${state.turn} over cap`);
  return problems;
}
