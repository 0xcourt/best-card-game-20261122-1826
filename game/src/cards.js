// The card pool of Ember Court: four suits, each with its own colour AND
// glyph (never text alone), twenty unique cards, and the 30-card deck builder.
// Suits: Ember red ▲, Tide blue ≈, Thorn green ✦, Stone gold ◆.

export const SUITS = {
  ember: { name: 'Ember', color: '#c0392b', dark: '#7b1f16', light: '#f5b7b1', glyph: '▲' },
  tide: { name: 'Tide', color: '#2471a3', dark: '#154a6b', light: '#aed6f1', glyph: '≈' },
  thorn: { name: 'Thorn', color: '#1e8449', dark: '#145a32', light: '#a9dfbf', glyph: '✦' },
  stone: { name: 'Stone', color: '#b7950b', dark: '#7d6608', light: '#f9e79f', glyph: '◆' },
};

// The three lanes of the court, each named after a suit.
export const LANES = [
  { suit: 'ember', name: 'Cinder Lane', glyph: '▲' },
  { suit: 'tide', name: 'Tide Lane', glyph: '≈' },
  { suit: 'thorn', name: 'Thorn Lane', glyph: '✦' },
];

// Card fields:
//   id, name, cost, suit, type ('unit' | 'spell'), text
//   units: attack, health, ward (bool), battlecry ('draw1' | 'heal3' | 'heal5')
//   spells: spell ('emberbolt' | 'wildfire' | 'mend' | 'rally' | 'insight' |
//           'frostbind' | 'quake'), target ('any' | 'enemyUnit' | 'friendlyUnit' | 'none')
export const CARDS = [
  { id: 'cinder-imp', name: 'Cinder Imp', cost: 1, suit: 'ember', type: 'unit', attack: 2, health: 1, text: 'A quick spark of the court.' },
  { id: 'flame-hound', name: 'Flame Hound', cost: 2, suit: 'ember', type: 'unit', attack: 3, health: 2, text: 'It chases every ember home.' },
  { id: 'pyre-knight', name: 'Pyre Knight', cost: 4, suit: 'ember', type: 'unit', attack: 5, health: 4, text: 'Sworn to the burning oath.' },
  { id: 'ash-dragon', name: 'Ash Dragon', cost: 6, suit: 'ember', type: 'unit', attack: 7, health: 6, text: 'Where it lands, the court burns.' },
  { id: 'mist-wisp', name: 'Mist Wisp', cost: 1, suit: 'tide', type: 'unit', attack: 1, health: 2, battlecry: 'draw1', text: 'Battlecry: draw a card.' },
  { id: 'tide-caller', name: 'Tide Caller', cost: 3, suit: 'tide', type: 'unit', attack: 2, health: 4, battlecry: 'draw1', text: 'Battlecry: draw a card.' },
  { id: 'deep-serpent', name: 'Deep Serpent', cost: 5, suit: 'tide', type: 'unit', attack: 6, health: 5, text: 'The deep keeps its own score.' },
  { id: 'sproutling', name: 'Sproutling', cost: 1, suit: 'thorn', type: 'unit', attack: 1, health: 3, battlecry: 'heal3', text: 'Battlecry: restore 3 life.' },
  { id: 'briar-wolf', name: 'Briar Wolf', cost: 3, suit: 'thorn', type: 'unit', attack: 4, health: 3, text: 'Thorns run with the pack.' },
  { id: 'grove-ancient', name: 'Grove Ancient', cost: 5, suit: 'thorn', type: 'unit', attack: 4, health: 7, battlecry: 'heal5', text: 'Battlecry: restore 5 life.' },
  { id: 'pebble-guard', name: 'Pebble Guard', cost: 2, suit: 'stone', type: 'unit', attack: 1, health: 5, ward: true, text: 'Ward: ignores the first hit.' },
  { id: 'granite-golem', name: 'Granite Golem', cost: 4, suit: 'stone', type: 'unit', attack: 3, health: 6, ward: true, text: 'Ward: ignores the first hit.' },
  { id: 'bastion-titan', name: 'Bastion Titan', cost: 7, suit: 'stone', type: 'unit', attack: 5, health: 8, ward: true, text: 'Ward: ignores the first hit.' },
  { id: 'emberbolt', name: 'Emberbolt', cost: 2, suit: 'ember', type: 'spell', spell: 'emberbolt', target: 'any', text: 'Deal 3 damage to a unit or the enemy hero.' },
  { id: 'wildfire', name: 'Wildfire', cost: 4, suit: 'ember', type: 'spell', spell: 'wildfire', target: 'none', text: 'Deal 2 damage to all enemy units.' },
  { id: 'mend', name: 'Mend', cost: 2, suit: 'thorn', type: 'spell', spell: 'mend', target: 'none', text: 'Restore 6 life.' },
  { id: 'rally-banner', name: 'Rally Banner', cost: 3, suit: 'thorn', type: 'spell', spell: 'rally', target: 'friendlyUnit', text: 'Give a friendly unit +2/+2.' },
  { id: 'insight', name: 'Insight', cost: 1, suit: 'tide', type: 'spell', spell: 'insight', target: 'none', text: 'Draw 2 cards.' },
  { id: 'frostbind', name: 'Frostbind', cost: 3, suit: 'tide', type: 'spell', spell: 'frostbind', target: 'enemyUnit', text: 'Deal 2 damage to a unit and draw a card.' },
  { id: 'quake', name: 'Quake', cost: 5, suit: 'stone', type: 'spell', spell: 'quake', target: 'none', text: 'Deal 4 damage to all enemy units.' },
];

export function cardById(id) {
  return CARDS.find((card) => card.id === id) || null;
}

// A 30-card deck: every unit twice except one copy each of the three
// cheapest units (Cinder Imp, Mist Wisp, Sproutling) is left out, plus one
// of each spell. 20 unique cards, 30 cards in all.
export function buildDeck() {
  const cheapest = ['cinder-imp', 'mist-wisp', 'sproutling'];
  const deck = [];
  for (const card of CARDS) {
    if (card.type === 'unit') {
      deck.push(card.id);
      if (!cheapest.includes(card.id)) deck.push(card.id);
    } else {
      deck.push(card.id);
    }
  }
  return deck;
}
