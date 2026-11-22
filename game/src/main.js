// Boot for Ember Court: reads ?shot= and ?seed= from the URL. In shot mode
// it stages one static frame (for the play shot it also selects the first
// playable unit card, so the frame shows the interaction). In live mode it
// wires mouse + keyboard, runs the Warden's turn on a short timer after the
// player ends theirs, plays sounds, and tracks wins / losses / duel count.
import { createGame, endTurn, needsTarget, playCard, startMatch } from './engine.js';
import { wardenTakeTurn } from './ai.js';
import { createRenderer } from './render.js';
import { ensureAudio, isMuted, setMuted, sfx } from './audio.js';
import { liveSeed, stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;

const app = document.getElementById('app');

let state;
let ui = {
  selected: null,
  muted: false,
  wins: 0,
  losses: 0,
  duels: 1,
};

let renderer;

function refresh() {
  renderer.render(state, ui);
}

function cancelSelection() {
  ui.selected = null;
  refresh();
}

function afterPlayerAction() {
  if (state.screen === 'over') {
    finishDuel();
    return;
  }
  refresh();
}

function finishDuel() {
  if (state.winner === 0) {
    ui.wins += 1;
    sfx.win();
  } else {
    ui.losses += 1;
    sfx.lose();
  }
  refresh();
}

function runWardenTurn() {
  if (state.screen !== 'play' || state.active !== 1) return;
  wardenTakeTurn(state, 1, state.rng);
  if (state.screen === 'over') {
    finishDuel();
    return;
  }
  endTurn(state);
  if (state.screen === 'over') {
    finishDuel();
    return;
  }
  sfx.turn();
  refresh();
}

const hooks = {
  onHandCard(handIndex) {
    if (state.screen !== 'play' || state.active !== 0) return;
    ensureAudio();
    if (ui.selected && ui.selected.handIndex === handIndex) {
      cancelSelection();
      return;
    }
    const card = state.sides[0].hand[handIndex];
    if (!card || card.cost > state.sides[0].energy) return;
    ui.selected = { handIndex };
    if (card.type === 'spell' && !needsTarget(card)) {
      // Instant spells resolve on click.
      const result = playCard(state, 0, handIndex, null, null);
      ui.selected = null;
      if (result.ok) {
        if (card.spell === 'mend') sfx.heal();
        else if (card.spell === 'insight') sfx.draw();
        else sfx.hit();
      }
      afterPlayerAction();
      return;
    }
    sfx.play();
    refresh();
  },

  onLane(lane) {
    if (!ui.selected) return;
    const card = state.sides[0].hand[ui.selected.handIndex];
    if (!card || card.type !== 'unit') return;
    ensureAudio();
    const result = playCard(state, 0, ui.selected.handIndex, lane, null);
    ui.selected = null;
    if (result.ok) sfx.play();
    afterPlayerAction();
  },

  onTarget(target) {
    if (!ui.selected) return;
    const card = state.sides[0].hand[ui.selected.handIndex];
    if (!card) return;
    ensureAudio();
    const result = playCard(state, 0, ui.selected.handIndex, null, target);
    ui.selected = null;
    if (result.ok) {
      if (card.spell === 'rally') sfx.play();
      else sfx.hit();
    }
    afterPlayerAction();
  },

  onEndTurn() {
    if (state.screen !== 'play' || state.active !== 0) return;
    ensureAudio();
    ui.selected = null;
    sfx.turn();
    endTurn(state);
    if (state.screen === 'over') {
      finishDuel();
      return;
    }
    refresh();
    window.setTimeout(runWardenTurn, 700);
  },

  onStart() {
    ensureAudio();
    startMatch(state);
    sfx.play();
    refresh();
  },

  onRestart() {
    ensureAudio();
    ui.duels += 1;
    ui.selected = null;
    state = createGame(liveSeed());
    startMatch(state);
    sfx.turn();
    refresh();
  },

  onMute() {
    setMuted(!isMuted());
    ui.muted = isMuted();
    refresh();
  },
};

renderer = createRenderer(app, hooks);

if (shot) {
  // Screenshot mode: one static frame, no timers, no sound.
  const staged = stageShot(shot, seed);
  state = staged.state;
  if (shot === 'win') ui.wins = 1;
  if (shot === 'lose') ui.losses = 1;
  if (shot === 'play') {
    // Select the first playable unit card so the frame shows the interaction.
    const handIndex = state.sides[0].hand.findIndex(
      (c) => c.type === 'unit' && c.cost <= state.sides[0].energy,
    );
    if (handIndex !== -1) ui.selected = { handIndex };
  }
  refresh();
} else {
  state = createGame(liveSeed());
  refresh();

  window.addEventListener('keydown', (event) => {
    if (state.screen === 'title') {
      if (event.key === 'Enter' || event.key === ' ') hooks.onStart();
      return;
    }
    if (state.screen === 'over') {
      if (event.key === 'Enter' || event.key === ' ') hooks.onRestart();
      return;
    }
    if (event.key >= '1' && event.key <= '7') {
      hooks.onHandCard(Number(event.key) - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      hooks.onEndTurn();
    } else if (event.key === 'Escape') {
      cancelSelection();
    }
  });
}
