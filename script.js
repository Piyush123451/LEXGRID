// ---------- Word list (all must be exactly 5 letters) ----------
const WORDS = [
  "apple","brave","crane","drink","eagle","flame","grape","house","ivory","jolly",
  "knife","lemon","mango","night","ocean","piano","queen","river","stone","tiger",
  "umbra","voice","water","xenon","young","zebra","about","above","actor","admit",
  "adult","after","again","agree","alarm","alone","angry","apart","arise","armor",
  "baker","beach","begin","black","blame","bleed","blind","blood","board","bonus",
  "brain","bread","break","brick","bring","brown","build","candy","carry","chair",
  "chalk","cheap","check","chest","child","clean","clear","climb","clock","close",
  "cloud","coach","coast","color","count","court","cover","crash","cream","crowd",
  "dance","death","delta","depth","dream","dress","drive","early","earth","empty",
  "enemy","enjoy","enter","equal","error","event","every","extra","faith","false",
  "field","fight","final","first","flash","floor","focus","force","frame","fresh",
  "front","fruit","giant","glass","globe","grace","grade","grain","grass","great",
  "green","group","guess","guide","happy","heart","heavy","honey","horse","hotel",
  "human","humor","image","index","input","issue","joint","judge","juice","knock",
  "laugh","layer","learn","least","leave","level","light","limit","local","lucky",
  "lunch","magic","major","maker","march","match","maybe","metal","money","month",
  "moral","motor","mount","mouse","mouth","movie","music","noise","north","novel",
  "nurse","offer","order","other","paint","panel","paper","party","peace","phone",
  "photo","pilot","pitch","place","plain","plane","plant","plate","point","power",
  "price","pride","print","prize","proud","queue","quick","quiet","radio","raise",
  "range","rapid","reach","ready","right","robot","rough","round","royal","salad",
  "scale","scene","score","sense","shape","share","sharp","sheep","shelf","shift",
  "shine","shirt","shock","shoot","short","sight","skill","sleep","slide","small",
  "smart","smile","smoke","solid","sound","south","space","speak","speed","spend",
  "sport","staff","stage","stand","start","state","steam","steel","stick","store",
  "storm","story","sugar","sweet","table","taste","teach","thank","theme","thing",
  "think","three","throw","title","today","tooth","topic","total","touch","tower",
  "track","trade","train","treat","trend","trial","trust","truth","uncle","under",
  "union","unity","until","upper","urban","usual","valid","value","video","visit",
  "vital","wagon","waste","watch","wheel","where","which","while","white","whole",
  "woman","world","worry","worth","write","wrong","youth"
];

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;
const FLIP_STAGGER = 300;   // ms between each tile flip
const FLIP_HALF = 300;      // ms until tile is edge-on (color changes here)
const FLIP_TOTAL = FLIP_STAGGER * (WORD_LENGTH - 1) + FLIP_HALF * 2;

const PRAISE = ["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"];

// ---------- Dictionary (guess validation) ----------
const DICTIONARY_URL =
  "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";

let validWords = new Set(WORDS);
let dictionaryLoaded = false;

async function loadDictionary() {
  try {
    const res = await fetch(DICTIONARY_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    text
      .split(/\r?\n/)
      .map(w => w.trim().toLowerCase())
      .filter(w => /^[a-z]{5}$/.test(w))
      .forEach(w => validWords.add(w));
    dictionaryLoaded = true;
    console.log("Dictionary loaded:", validWords.size, "words");
  } catch (err) {
    console.warn("Could not load dictionary, skipping word check.", err);
  }
}

// ---------- Stats (saved in the browser) ----------
const STATS_KEY = "lexigrid-stats";
let stats = loadStats();

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY));
    if (s && typeof s.streak === "number") return s;
  } catch (e) { /* ignore */ }
  return { streak: 0, best: 0, wins: 0, played: 0 };
}

function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
}

function renderStats(bumpId) {
  const ids = { streak: stats.streak, best: stats.best, wins: stats.wins, played: stats.played };
  for (const id in ids) document.getElementById(id).textContent = ids[id];

  document.getElementById("streakBox").classList.toggle("hot", stats.streak >= 3);

  if (bumpId) {
    const el = document.getElementById(bumpId);
    el.classList.remove("bump");
    void el.offsetWidth; // restart animation
    el.classList.add("bump");
  }
}

function recordWin() {
  stats.streak++;
  stats.wins++;
  stats.played++;
  if (stats.streak > stats.best) stats.best = stats.streak;
  saveStats();
  renderStats("streak");
  document.getElementById("wins").classList.add("bump");
  document.getElementById("played").classList.add("bump");
  if (stats.best === stats.streak && stats.streak > 1) {
    document.getElementById("best").classList.add("bump");
  }
}

function recordLoss() {
  const hadStreak = stats.streak > 0;
  stats.streak = 0;
  stats.played++;
  saveStats();
  renderStats("played");
  if (hadStreak) {
    const box = document.getElementById("streakBox");
    box.classList.remove("lost");
    void box.offsetWidth;
    box.classList.add("lost");
    setTimeout(() => box.classList.remove("lost"), 800);
  }
}

// ---------- Elements & state ----------
const KEY_ROWS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  ["Enter", ..."zxcvbnm".split(""), "Back"]
];

const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const messageEl = document.getElementById("message");

let secret, currentRow, currentGuess, gameOver, busy;
let messageTimer = null;

// ---------- Message toast ----------
function showMessage(text, sticky = false, duration = 1400) {
  clearTimeout(messageTimer);
  messageEl.textContent = text;
  messageEl.classList.add("show");
  if (!sticky) {
    messageTimer = setTimeout(() => messageEl.classList.remove("show"), duration);
  }
}

function hideMessage() {
  clearTimeout(messageTimer);
  messageEl.classList.remove("show");
}

// ---------- Setup ----------
function buildBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement("div");
    row.className = "row";
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }
}

function buildKeyboard() {
  keyboardEl.innerHTML = "";
  KEY_ROWS.forEach(keys => {
    const row = document.createElement("div");
    row.className = "kb-row";
    keys.forEach(k => {
      const btn = document.createElement("button");
      btn.className = "key" + (k.length > 1 ? " wide" : "");
      btn.textContent = k === "Back" ? "⌫" : k;
      btn.dataset.key = k.toLowerCase();
      btn.addEventListener("click", () => {
        btn.blur(); // stops physical Enter from re-clicking the button
        handleKey(k);
      });
      row.appendChild(btn);
    });
    keyboardEl.appendChild(row);
  });
}

function newGame() {
  secret = WORDS[Math.floor(Math.random() * WORDS.length)];
  currentRow = 0;
  currentGuess = "";
  gameOver = false;
  busy = false;
  hideMessage();
  buildBoard();
  buildKeyboard();
}

// ---------- Input ----------
function handleKey(key) {
  if (gameOver || busy) return;
  if (key === "Enter") return submitGuess();

  if (key === "Backspace" || key === "Back") {
    currentGuess = currentGuess.slice(0, -1);
    renderCurrentRow();
  } else if (/^[a-zA-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
    currentGuess += key.toLowerCase();
    renderCurrentRow(currentGuess.length - 1);
  }
}

function renderCurrentRow(popIndex = -1) {
  const tiles = boardEl.children[currentRow].children;
  for (let i = 0; i < WORD_LENGTH; i++) {
    tiles[i].textContent = currentGuess[i] || "";
    tiles[i].classList.toggle("filled", !!currentGuess[i]);
  }
  if (popIndex >= 0) {
    const t = tiles[popIndex];
    t.classList.remove("pop");
    void t.offsetWidth;
    t.classList.add("pop");
  }
}

// ---------- Game logic ----------
function submitGuess() {
  const rowEl = boardEl.children[currentRow];

  if (currentGuess.length < WORD_LENGTH) {
    return showError("Not enough letters", rowEl);
  }
  if (dictionaryLoaded && !validWords.has(currentGuess)) {
    return showError("Not in word list", rowEl);
  }

  busy = true;
  const guess = currentGuess;
  const rowIndex = currentRow;
  const result = evaluateGuess(guess, secret);
  const tiles = rowEl.children;

  // Staggered flip reveal
  result.forEach((status, i) => {
    setTimeout(() => {
      tiles[i].classList.remove("filled", "pop");
      tiles[i].classList.add("flip");
    }, i * FLIP_STAGGER);

    setTimeout(() => {
      tiles[i].classList.add(status);      // color appears when edge-on
      updateKeyboard(guess[i], status);
    }, i * FLIP_STAGGER + FLIP_HALF);
  });

  // After the last flip finishes, decide what happens next
  setTimeout(() => {
    if (guess === secret) {
      handleWin(rowEl, rowIndex);
    } else if (rowIndex === MAX_GUESSES - 1) {
      handleLoss();
    } else {
      currentRow++;
      currentGuess = "";
      busy = false;
    }
  }, FLIP_TOTAL);
}

function handleWin(rowEl, rowIndex) {
  gameOver = true;
  busy = false;
  Array.from(rowEl.children).forEach((tile, i) => {
    tile.classList.remove("flip");
    tile.style.animationDelay = i * 100 + "ms";
    tile.classList.add("bounce");
  });
  recordWin();
  launchConfetti();
  const extra = stats.streak > 1 ? "  🔥 " + stats.streak + " in a row!" : "";
  showMessage(PRAISE[rowIndex] + extra, true);
}

function handleLoss() {
  gameOver = true;
  busy = false;
  recordLoss();
  showMessage("The word was " + secret.toUpperCase() + " — streak reset 💔", true);
}

// Handles repeated letters correctly (two passes)
function evaluateGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("absent");
  const remaining = {};

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    if (remaining[guess[i]] > 0) {
      result[i] = "present";
      remaining[guess[i]]--;
    }
  }
  return result;
}

function updateKeyboard(letter, status) {
  const keyEl = keyboardEl.querySelector(`[data-key="${letter}"]`);
  if (!keyEl) return;
  if (keyEl.classList.contains("correct")) return;
  if (keyEl.classList.contains("present") && status === "absent") return;
  keyEl.classList.remove("present", "absent");
  keyEl.classList.add(status);
}

function showError(text, rowEl) {
  showMessage(text);
  rowEl.classList.remove("shake");
  void rowEl.offsetWidth;
  rowEl.classList.add("shake");
  setTimeout(() => rowEl.classList.remove("shake"), 450);
}

// ---------- Confetti ----------
const canvas = document.getElementById("confetti");
const ctx = canvas.getContext("2d");
let particles = [];
let confettiFrame = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function launchConfetti() {
  const colors = ["#8e5cf0", "#c4a8ff", "#e58fc0", "#f6d6ff", "#a9c4ff", "#ffffff"];
  for (let i = 0; i < 160; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 16,
      vy: Math.random() * -13 - 3,
      size: 6 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      life: 0
    });
  }
  if (!confettiFrame) confettiFrame = requestAnimationFrame(confettiTick);
}

function confettiTick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach(p => {
    p.vy += 0.35;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life++;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  });
  particles = particles.filter(p => p.y < canvas.height + 20 && p.life < 240);
  if (particles.length) {
    confettiFrame = requestAnimationFrame(confettiTick);
  } else {
    confettiFrame = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ---------- Events ----------
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  handleKey(e.key);
});

// Remove the bump class once finished so it can replay next time
document.querySelectorAll(".stat-num").forEach(el => {
  el.addEventListener("animationend", () => el.classList.remove("bump"));
});

document.getElementById("restart").addEventListener("click", e => {
  e.target.blur();
  // Quitting a game you've already started counts as a loss
  const abandoned = !gameOver && currentRow > 0;
  if (abandoned) recordLoss();
  newGame();
  if (abandoned) showMessage("Game abandoned — streak reset");
});

// ---------- Start ----------
renderStats();
loadDictionary();
newGame();