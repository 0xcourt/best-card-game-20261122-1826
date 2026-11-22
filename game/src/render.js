// The table: builds the Ember Court skeleton once, then repaints everything
// from engine state. DOM only — all rules live in engine.js. Card faces,
// lane units, hero boxes, the log strip and the title / win / lose overlays
// are all built here.
import { LANES, SUITS } from './cards.js';
import { needsTarget } from './engine.js';

// Suit colour as a CSS custom property on each card face.
function suitStyle(suit) {
  const s = SUITS[suit];
  return `--suit:${s.color};--suit-dark:${s.dark};--suit-light:${s.light};`;
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// One card face. `mini` shrinks it for lane units (~86x118 instead of
// ~104x148). The rules text is capped to a fixed height so it never
// touches the stat badges.
export function cardFaceHtml(card, mini) {
  const suit = SUITS[card.suit];
  const classes = ['card', card.type, mini ? 'mini' : '', `suit-${card.suit}`].join(' ');
  const wardTag = card.type === 'unit' && card.ward
    ? '<span class="ward-tag">WARD</span>' : '';
  const stats = card.type === 'unit'
    ? `<span class="stat atk">⚔ ${card.attack}</span><span class="stat hp">♥ ${card.health}</span>`
    : '<span class="spell-tag">SPELL</span>';
  return `<div class="${classes}" style="${suitStyle(card.suit)}" data-uid="${card.uid}">
    <span class="cost">${card.cost}</span>
    <span class="suit-glyph">${suit.glyph}</span>
    <div class="art"><span class="art-glyph">${suit.glyph}</span><span class="art-suit">${suit.name.toUpperCase()}</span></div>
    <div class="card-name">${escapeHtml(card.name)}</div>
    <div class="card-text">${escapeHtml(card.text)}</div>
    ${wardTag}
    <div class="card-stats">${stats}</div>
  </div>`;
}

function heroBoxHtml(side, life, isEnemy) {
  const glyph = isEnemy ? '♛' : '♞';
  const name = isEnemy ? 'WARDEN OF THE COURT' : 'CHALLENGER';
  const sub = isEnemy ? 'Keeper of the Four Suits' : 'You · the Ember Court';
  return `<div class="portrait">${glyph}</div>
    <div class="hero-names"><div class="hero-name">${name}</div><div class="hero-sub">${sub}</div></div>
    <div class="hero-life"><span class="life-num">${life}</span><span class="life-label">LIFE</span></div>`;
}

export function createRenderer(appEl, hooks) {
  appEl.innerHTML = `<div id="table">
    <div id="top-row">
      <div class="hero-box enemy" id="enemy-hero"></div>
      <div id="enemy-hand"></div>
      <div id="turn-box"></div>
    </div>
    <div id="lanes"></div>
    <div id="hint"></div>
    <div id="bottom-row">
      <div class="hero-box player" id="player-hero"></div>
      <div id="hand"></div>
      <div id="controls"></div>
    </div>
    <div id="log"></div>
    <div id="overlay"></div>
  </div>`;

  const enemyHeroEl = appEl.querySelector('#enemy-hero');
  const enemyHandEl = appEl.querySelector('#enemy-hand');
  const turnBoxEl = appEl.querySelector('#turn-box');
  const lanesEl = appEl.querySelector('#lanes');
  const hintEl = appEl.querySelector('#hint');
  const playerHeroEl = appEl.querySelector('#player-hero');
  const handEl = appEl.querySelector('#hand');
  const controlsEl = appEl.querySelector('#controls');
  const logEl = appEl.querySelector('#log');
  const overlayEl = appEl.querySelector('#overlay');

  function render(state, ui) {
    const player = state.sides[0];
    const warden = state.sides[1];
    const selected = ui.selected ? player.hand[ui.selected.handIndex] : null;
    const targeting = selected && selected.type === 'spell' && needsTarget(selected);

    // --- top row ---
    enemyHeroEl.innerHTML = heroBoxHtml(1, warden.life, true);
    enemyHeroEl.classList.toggle('targetable', Boolean(targeting && selected.target === 'any'));
    enemyHeroEl.onclick = () => {
      if (targeting && selected.target === 'any') hooks.onTarget({ kind: 'hero', side: 1 });
    };

    let backs = '';
    for (let i = 0; i < warden.hand.length; i += 1) backs += '<span class="mini-back">✦</span>';
    enemyHandEl.innerHTML = `<div class="backs">${backs}</div><span class="hand-count">${warden.hand.length} cards</span>`;

    const pill = state.screen === 'over'
      ? 'DUEL OVER'
      : state.active === 0 ? 'YOUR TURN' : "WARDEN'S TURN";
    turnBoxEl.innerHTML = `<div class="turn-pill">${pill}</div>
      <div class="duel-line">DUEL ${ui.duels} · W ${ui.wins} – L ${ui.losses} · TURN ${state.turn}</div>`;

    // --- lanes ---
    let lanesHtml = '';
    LANES.forEach((lane, i) => {
      const foeUnit = warden.lanes[i];
      const myUnit = player.lanes[i];
      const foeHtml = foeUnit
        ? `<div class="lane-unit enemy-unit" data-side="1" data-lane="${i}">${cardFaceHtml(foeUnit, true)}</div>`
        : '<div class="lane-slot empty"><span class="slot-dash">—</span></div>';
      const dropHint = selected && selected.type === 'unit' && !myUnit ? ' drop-hint' : '';
      const myHtml = myUnit
        ? `<div class="lane-unit" data-side="0" data-lane="${i}">${cardFaceHtml(myUnit, true)}</div>`
        : `<div class="lane-slot empty${dropHint}" data-lane="${i}"><span class="slot-dash">—</span></div>`;
      const foeTargetable = targeting && selected.target === 'any' && foeUnit ? ' targetable' : '';
      const foeTargetableUnit = targeting && selected.target === 'enemyUnit' && foeUnit ? ' targetable' : '';
      lanesHtml += `<div class="lane">
        <div class="lane-top${foeTargetable}${foeTargetableUnit}">${foeHtml}</div>
        <div class="lane-label"><span class="lane-glyph">${lane.glyph}</span> ${lane.name}</div>
        <div class="lane-bottom">${myHtml}</div>
      </div>`;
    });
    lanesEl.innerHTML = lanesHtml;

    // Target clicks on enemy lane units.
    lanesEl.querySelectorAll('.lane-unit.enemy-unit').forEach((el) => {
      el.onclick = () => {
        if (!targeting) return;
        const lane = Number(el.dataset.lane);
        if (selected.target === 'any' || selected.target === 'enemyUnit') {
          hooks.onTarget({ kind: 'unit', side: 1, lane });
        }
      };
    });
    // Friendly-unit targets (Rally Banner).
    lanesEl.querySelectorAll('.lane-unit:not(.enemy-unit)').forEach((el) => {
      el.onclick = () => {
        if (targeting && selected.target === 'friendlyUnit') {
          hooks.onTarget({ kind: 'unit', side: 0, lane: Number(el.dataset.lane) });
        }
      };
    });
    // Lane clicks: play a selected unit into an empty player slot.
    lanesEl.querySelectorAll('.lane-slot[data-lane]').forEach((el) => {
      el.onclick = () => {
        if (selected && selected.type === 'unit') hooks.onLane(Number(el.dataset.lane));
      };
    });

    // --- hint line ---
    if (state.screen === 'over') {
      hintEl.textContent = state.winner === 0 ? 'Victory — the court is yours.' : 'Defeat — the Warden keeps the court.';
    } else if (targeting) {
      hintEl.textContent = 'Choose a target — click a glowing unit or the Warden (Esc to cancel)';
    } else if (selected && selected.type === 'unit') {
      hintEl.textContent = 'Card selected — click a lane to play it (Esc to cancel)';
    } else if (selected) {
      hintEl.textContent = 'Spell selected — it resolves at once (Esc to cancel)';
    } else if (state.active === 0) {
      hintEl.textContent = 'Click a card, then a lane or a target. Keys 1–7 select · Enter ends turn.';
    } else {
      hintEl.textContent = 'The Warden is thinking…';
    }

    // --- bottom row: player hero, hand, controls ---
    playerHeroEl.innerHTML = heroBoxHtml(0, player.life, false);

    let handHtml = '';
    player.hand.forEach((card, i) => {
      const playable = state.screen === 'play' && state.active === 0 && card.cost <= player.energy;
      const isSelected = ui.selected && ui.selected.handIndex === i;
      const classes = ['hand-card', playable ? 'playable' : 'dim', isSelected ? 'selected' : ''].join(' ');
      handHtml += `<div class="${classes}" data-hand="${i}">${cardFaceHtml(card, false)}</div>`;
    });
    handEl.innerHTML = handHtml;
    handEl.querySelectorAll('.hand-card').forEach((el) => {
      el.onclick = () => hooks.onHandCard(Number(el.dataset.hand));
    });

    let gems = '';
    for (let i = 0; i < 10; i += 1) gems += `<span class="gem${i < player.energy ? ' on' : ''}"></span>`;
    const canEnd = state.screen === 'play' && state.active === 0;
    controlsEl.innerHTML = `<div class="deck-line">Deck ${player.deck.length} · Foe ${warden.deck.length}</div>
      <div class="energy-row"><span class="gems">${gems}</span><span class="energy-num">${player.energy}/${player.maxEnergy}</span></div>
      <button id="end-turn" ${canEnd ? '' : 'disabled'}>END TURN ⏎</button>
      <button id="mute-btn" class="small-btn">${ui.muted ? '♪ OFF' : '♪ ON'}</button>`;
    const endBtn = controlsEl.querySelector('#end-turn');
    if (endBtn) endBtn.onclick = () => hooks.onEndTurn();
    const muteBtn = controlsEl.querySelector('#mute-btn');
    if (muteBtn) muteBtn.onclick = () => hooks.onMute();

    // --- log strip: the two freshest events ---
    const tail = state.log.slice(-2);
    logEl.innerHTML = tail.map((line) => `<div>${escapeHtml(line)}</div>`).join('');

    // --- overlay ---
    overlayEl.innerHTML = overlayHtml(state, ui);
    const startBtn = overlayEl.querySelector('#start-btn');
    if (startBtn) startBtn.onclick = () => hooks.onStart();
    const againBtn = overlayEl.querySelector('#again-btn');
    if (againBtn) againBtn.onclick = () => hooks.onRestart();
  }

  return { render };
}

function overlayHtml(state, ui) {
  if (state.screen === 'title') {
    const chips = Object.values(SUITS).map((s) => (
      `<span class="suit-chip" style="--suit:${s.color}">${s.glyph} ${s.name}</span>`
    )).join('');
    return `<div class="scrim"></div><div class="panel title-panel">
      <div class="kicker">A DUEL OF THE FOUR SUITS</div>
      <h1>EMBER COURT</h1>
      <p class="pitch">Play units into three lanes. At the end of your turn they strike — break the Warden's guard and take all 30 of their life before they take yours.</p>
      <div class="chips">${chips}</div>
      <ul class="rules">
        <li>▲ Each turn: draw 1 card, gain +1 energy (max 10).</li>
        <li>◆ Units in a lane trade blows; survivors strike the hero.</li>
        <li>✦ Spells: burn, heal, rally, draw — spend energy wisely.</li>
      </ul>
      <button id="start-btn" class="gold-btn">▶ ENTER THE COURT</button>
      <div class="keys-hint">Mouse: click a card, then a lane · Keys: 1–7 select · Enter ends turn · Esc cancels</div>
    </div>`;
  }
  if (state.screen === 'over' && state.winner === 0) {
    return `<div class="scrim"></div><div class="panel end-panel">
      <div class="kicker">THE COURT IS YOURS</div>
      <h1 class="win-title">VICTORY</h1>
      <p class="stats-line">Life left: ${state.sides[0].life} · Turns: ${state.turn} · Cards played: ${state.sides[0].cardsPlayed}</p>
      <p class="pitch">The Warden bows. The four suits are yours to command.</p>
      <button id="again-btn" class="gold-btn">↻ DUEL AGAIN</button>
    </div>`;
  }
  if (state.screen === 'over') {
    return `<div class="scrim"></div><div class="panel end-panel">
      <div class="kicker">THE WARDEN PREVAILS</div>
      <h1 class="lose-title">DEFEAT</h1>
      <p class="stats-line">Life left: ${state.sides[0].life} · Turns: ${state.turn} · Cards played: ${state.sides[0].cardsPlayed}</p>
      <p class="pitch">The Warden keeps the court — for now. Shuffle up and try again.</p>
      <button id="again-btn" class="gold-btn">↻ DUEL AGAIN</button>
    </div>`;
  }
  return '';
}
