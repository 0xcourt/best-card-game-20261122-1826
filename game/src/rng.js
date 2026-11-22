// Seeded random numbers for Ember Court: one tiny generator (mulberry32),
// a seeded Fisher-Yates shuffle and a pick-int helper. Every shuffle and
// every AI jitter in the game flows through these, so a seed replays a duel.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle driven by a seeded rng; returns a new array.
export function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Integer in [min, max], inclusive, from a seeded rng.
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// A small jitter in [-amount, +amount] for AI scores.
export function jitter(rng, amount) {
  return (rng() * 2 - 1) * amount;
}
