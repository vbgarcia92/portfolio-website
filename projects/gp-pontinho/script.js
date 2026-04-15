// =============================================
//   Grand Prix do Pontinho — Game Logic
// =============================================

const MAX_POINTS = 100;

const state = {
  player1: { name: 'Player 1', score: 0 },
  player2: { name: 'Player 2', score: 0 },
  round: 1,
  history: [],
};

// ---- DOM References ----
const setupScreen  = document.getElementById('setup-screen');
const gameScreen   = document.getElementById('game-screen');
const winnerScreen = document.getElementById('winner-screen');

const player1Input = document.getElementById('player1-name');
const player2Input = document.getElementById('player2-name');
const startBtn     = document.getElementById('start-game-btn');

const p1DisplayName = document.getElementById('p1-display-name');
const p2DisplayName = document.getElementById('p2-display-name');
const p1Score       = document.getElementById('p1-score');
const p2Score       = document.getElementById('p2-score');
const p1Bar         = document.getElementById('p1-bar');
const p2Bar         = document.getElementById('p2-bar');
const roundDisplay  = document.getElementById('round-display');
const roundTitle    = document.getElementById('round-title');

const pointsInput   = document.getElementById('points-input');
const loserName1    = document.getElementById('loser-name-1');
const loserName2    = document.getElementById('loser-name-2');
const submitRoundBtn = document.getElementById('submit-round-btn');
const historyBody   = document.getElementById('history-body');
const histP1Name    = document.getElementById('hist-p1-name');
const histP2Name    = document.getElementById('hist-p2-name');

const winnerNameDisplay = document.getElementById('winner-name-display');
const fsP1Name  = document.getElementById('fs-p1-name');
const fsP2Name  = document.getElementById('fs-p2-name');
const fsP1Score = document.getElementById('fs-p1-score');
const fsP2Score = document.getElementById('fs-p2-score');
const newGameBtn = document.getElementById('new-game-btn');

// ---- Screens ----
function showScreen(screen) {
  [setupScreen, gameScreen, winnerScreen].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

// ---- Toast ----
let toastTimeout;
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---- Start Game ----
startBtn.addEventListener('click', () => {
  const name1 = player1Input.value.trim() || 'Player 1';
  const name2 = player2Input.value.trim() || 'Player 2';

  if (name1 === name2) {
    showToast('Players must have different names!');
    return;
  }

  state.player1 = { name: name1, score: 0 };
  state.player2 = { name: name2, score: 0 };
  state.round = 1;
  state.history = [];

  initGameScreen();
  showScreen(gameScreen);
});

// ---- Init Game Screen ----
function initGameScreen() {
  p1DisplayName.textContent = state.player1.name;
  p2DisplayName.textContent = state.player2.name;
  loserName1.textContent    = state.player1.name;
  loserName2.textContent    = state.player2.name;
  histP1Name.textContent    = state.player1.name;
  histP2Name.textContent    = state.player2.name;

  updateScoreboard();
  updateRoundUI();
  renderHistory();

  // Clear radio selection
  document.querySelectorAll('input[name="loser"]').forEach(r => r.checked = false);
  pointsInput.value = '';
}

// ---- Update Scoreboard ----
function updateScoreboard() {
  p1Score.textContent = state.player1.score;
  p2Score.textContent = state.player2.score;

  const p1Pct = Math.min((state.player1.score / MAX_POINTS) * 100, 100);
  const p2Pct = Math.min((state.player2.score / MAX_POINTS) * 100, 100);
  p1Bar.style.width = p1Pct + '%';
  p2Bar.style.width = p2Pct + '%';

  roundDisplay.textContent = state.round;
}

// ---- Update Round UI ----
function updateRoundUI() {
  roundTitle.textContent = `Round ${state.round}`;
  pointsInput.value = '';
  document.querySelectorAll('input[name="loser"]').forEach(r => r.checked = false);
}

// ---- Submit Round ----
submitRoundBtn.addEventListener('click', () => {
  const pointsVal = parseInt(pointsInput.value, 10);
  const loserRadio = document.querySelector('input[name="loser"]:checked');

  if (!pointsVal || pointsVal < 1) {
    showToast('Enter a valid number of points!');
    return;
  }

  if (!loserRadio) {
    showToast('Select who lost this round!');
    return;
  }

  const loserNum = parseInt(loserRadio.value, 10);
  const loserPlayer  = loserNum === 1 ? state.player1 : state.player2;

  // Award points to the loser
  loserPlayer.score += pointsVal;

  // Record history
  const record = {
    round: state.round,
    loser: loserNum,
    points: pointsVal,
    p1Total: state.player1.score,
    p2Total: state.player2.score,
  };
  state.history.push(record);
  renderHistory();

  // Check win condition
  if (loserPlayer.score >= MAX_POINTS) {
    // The OTHER player wins
    const winner = loserNum === 1 ? state.player2 : state.player1;
    triggerWinner(winner);
    return;
  }

  // Advance round
  state.round += 1;
  updateScoreboard();
  updateRoundUI();
});

// ---- Render History ----
function renderHistory() {
  historyBody.innerHTML = '';

  if (state.history.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="3" style="color: rgba(255,255,255,0.2); font-style: italic;">No rounds yet</td>`;
    historyBody.appendChild(row);
    return;
  }

  // Render newest first
  [...state.history].reverse().forEach(record => {
    const row = document.createElement('tr');

    const p1Points = record.loser === 1 ? record.points : '-';
    const p2Points = record.loser === 2 ? record.points : '-';

    const p1Cell = record.loser === 1
      ? `<td class="loser-cell">+${record.points} (${record.p1Total})</td>`
      : `<td style="color:rgba(255,255,255,0.3)">— (${record.p1Total})</td>`;

    const p2Cell = record.loser === 2
      ? `<td class="loser-cell">+${record.points} (${record.p2Total})</td>`
      : `<td style="color:rgba(255,255,255,0.3)">— (${record.p2Total})</td>`;

    row.innerHTML = `
      <td class="points-cell">${record.round}</td>
      ${p1Cell}
      ${p2Cell}
    `;
    historyBody.appendChild(row);
  });
}

// ---- Trigger Winner ----
function triggerWinner(winner) {
  updateScoreboard();

  winnerNameDisplay.textContent = winner.name;
  fsP1Name.textContent  = state.player1.name;
  fsP2Name.textContent  = state.player2.name;
  fsP1Score.textContent = state.player1.score + ' pts';
  fsP2Score.textContent = state.player2.score + ' pts';

  showScreen(winnerScreen);
}

// ---- New Game ----
newGameBtn.addEventListener('click', () => {
  player1Input.value = '';
  player2Input.value = '';
  showScreen(setupScreen);
});

// ---- Allow Enter key on setup inputs ----
[player1Input, player2Input].forEach(input => {
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') startBtn.click();
  });
});

// ---- Allow Enter key on points input ----
pointsInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitRoundBtn.click();
});
