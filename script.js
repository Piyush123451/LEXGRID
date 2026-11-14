// ---------- Word list (add as many 5-letter words as you like) ----------
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
  "human","humor","image","index","input","issue","joint","judge","juice","keeper",
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
// Big list of valid 5-letter English words, used only to validate guesses
const DICTIONARY_URL =
  "https://raw.githubusercontent.com/tabatkins/wordle-list/main/words";

let validWords = new Set(WORDS); // starts with your small list
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

const KEY_ROWS = [
  "qwertyuiop".split(""),
  "asdfghjkl".split(""),
  ["Enter", ..."zxcvbnm".split(""), "Back"]
];

const boardEl = document.getElementById("board");
const keyboardEl = document.getElementById("keyboard");
const messageEl = document.getElementById("message");

let secret, currentRow, currentGuess, gameOver;

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
      btn.addEventListener("click", () => handleKey(k));
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
  messageEl.textContent = "";
  buildBoard();
  buildKeyboard();
}

// ---------- Input ----------
function handleKey(key) {
  if (gameOver) return;
  if (key === "Enter") return submitGuess();
  if (key === "Backspace" || key === "Back") {
    currentGuess = currentGuess.slice(0, -1);
  } else if (/^[a-zA-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
    currentGuess += key.toLowerCase();
  }
  renderCurrentRow();
}

function renderCurrentRow() {
  const tiles = boardEl.children[currentRow].children;
  for (let i = 0; i < WORD_LENGTH; i++) {
    tiles[i].textContent = currentGuess[i] || "";
    tiles[i].classList.toggle("filled", !!currentGuess[i]);
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

  const result = evaluateGuess(currentGuess, secret);
  const tiles = rowEl.children;
  result.forEach((status, i) => {
    tiles[i].classList.add(status);
    updateKeyboard(currentGuess[i], status);
  });

  if (currentGuess === secret) {
    messageEl.textContent = "🎉 You won!";
    gameOver = true;
  } else if (currentRow === MAX_GUESSES - 1) {
    messageEl.textContent = "The word was: " + secret.toUpperCase();
    gameOver = true;
  } else {
    currentRow++;
    currentGuess = "";
  }
}

// Handles repeated letters correctly (two passes)
function evaluateGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("absent");
  const remaining = {};

  // Pass 1: exact matches
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }
  // Pass 2: right letter, wrong spot (only as many as remain)
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
  messageEl.textContent = text;
  rowEl.classList.add("shake");
  setTimeout(() => {
    rowEl.classList.remove("shake");
    if (!gameOver) messageEl.textContent = "";
  }, 1200);
}

// ---------- Events ----------
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  handleKey(e.key);
});
document.getElementById("restart").addEventListener("click", e => {
  e.target.blur(); // so Enter doesn't re-trigger the button
  newGame();
});

loadDictionary();
newGame();
