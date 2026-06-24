/* ══════════════════════════════════════════
   VBL CASINO — app.js
   Slots + Dice (3D Canvas) + Roulette + Mines
   ══════════════════════════════════════════ */

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const BACKEND = "https://sponge-chatroom-reforest.ngrok-free.dev";
const SYMBOLS = ["💎","7️⃣","🍀","⭐","🔔","🍋","🍒"];

let balance      = 0;
let initData     = tg.initData || "";
let isSpinning   = false;
let diceChosen   = null;
let rouletteBetType  = null;
let rouletteBetValue = null;

async function init() {
  console.log("[VBL] init() started");
  console.log("[VBL] tg.initData length:", tg.initData?.length ?? 0);
  console.log("[VBL] BACKEND:", BACKEND);

  try {
    const pingRes = await fetch(BACKEND + "/api/ping", {
      headers: { "bypass-tunnel-reminder": "true", "ngrok-skip-browser-warning": "true" }
    });
    const pingText = await pingRes.text();
    console.log("[VBL] /api/ping status:", pingRes.status);
    console.log("[VBL] /api/ping body (first 200):", pingText.slice(0, 200));
  } catch(e) {
    console.error("[VBL] /api/ping FAILED — туннель недоступен!", e.message);
    updateBalanceUI(0, "💀");
    return;
  }

  try {
    const echoRes = await fetch(BACKEND + "/api/echo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Init-Data": initData,
        "bypass-tunnel-reminder": "true",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ test: true })
    });
    const echoData = await echoRes.json();
    console.log("[VBL] /api/echo X-Init-Data_present:", echoData["X-Init-Data_present"]);
    console.log("[VBL] /api/echo X-Init-Data_length:", echoData["X-Init-Data_length"]);
    if (!echoData["X-Init-Data_present"]) {
      console.error("[VBL] Заголовок X-Init-Data НЕ дошёл до сервера!");
    }
  } catch(e) {
    console.error("[VBL] /api/echo failed:", e.message);
  }

  await fetchBalance();
  await fetchBonusStatus();
}

async function fetchBalance() {
  try {
    const res = await apiFetch("/api/balance", "GET");
    balance = res.balance;
    updateBalanceUI(res.balance, res.rank_emoji);
    console.log("[VBL] Balance loaded:", res.balance);
  } catch(e) {
    console.error("[VBL] fetchBalance error:", e.message);
    updateBalanceUI(0, "❓");
  }
}

function updateBalanceUI(val, rankEmoji) {
  balance = val;
  document.getElementById("balanceDisplay").textContent = fmtNum(val);
  if (rankEmoji) document.getElementById("rankDisplay").textContent = rankEmoji;
}

function fmtNum(n) {
  return Number(n).toLocaleString("ru-RU");
}

async function apiFetch(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Init-Data": initData,
      "bypass-tunnel-reminder": "true",
      "ngrok-skip-browser-warning": "true",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  console.log(`[VBL] fetch ${method} ${BACKEND + path}`);
  const res = await fetch(BACKEND + path, opts);

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("[VBL] Non-JSON response:", text.slice(0, 300));
    throw new Error("Бэкенд вернул не JSON — проверь туннель.");
  }
  if (!res.ok) {
    console.error(`[VBL] API error ${res.status}:`, data);
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function openGame(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-" + name).classList.add("active");
  if (name === "slots")    initSlots();
  if (name === "dice")     initDice();
  if (name === "roulette") initRoulette();
  if (name === "mines")    initMines();
  if (name === "blackjack") initBlackjack();
  if (name === "poker")    initPoker();
  if (name === "crash")    initCrash();
  if (name === "pvpbj")   openPvpBj();
  if (name !== "crash")    stopCrash();
}

function goLobby() {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-lobby").classList.add("active");
  stopCrash();
}

let toastTimer;
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = "toast"; }, 2800);
}

// ══════════════════════════════════════════
//  SLOTS
// ══════════════════════════════════════════

const REEL_SYMBOLS = ["💎","7️⃣","🍀","⭐","🔔","🍋","🍒","🍒","🍒","🍋","🍋","🔔","⭐"];

function initSlots() {
  for (let i = 0; i < 3; i++) {
    const strip = document.getElementById("reel" + i);
    strip.innerHTML = "";
    for (let j = 0; j < 3; j++) {
      const sym = document.createElement("div");
      sym.className = "reel-symbol";
      sym.textContent = REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
      strip.appendChild(sym);
    }
  }
  document.getElementById("slotsResultMsg").textContent = "";
  document.getElementById("slotsResultMsg").className = "slots-result-msg";
}

function changeBet(delta) {
  const inp = document.getElementById("slotsBet");
  inp.value = Math.max(10, Math.min(100000, Number(inp.value) + delta));
}
function setBet(val) {
  document.getElementById("slotsBet").value = val;
}

async function playSlotsGame() {
  if (isSpinning) return;
  const bet = Number(document.getElementById("slotsBet").value);
  if (!bet || bet < 10) { showToast("Минимальная ставка: 10 VBL", "info"); return; }
  if (bet > balance)    { showToast("Недостаточно VBL-Coins!", "lose"); return; }

  isSpinning = true;
  const btn = document.getElementById("spinBtn");
  btn.disabled = true;

  const msg = document.getElementById("slotsResultMsg");
  msg.textContent = "🎰 Крутим...";
  msg.className = "slots-result-msg";

  const intervals = [null, null, null];
  for (let i = 0; i < 3; i++) {
    intervals[i] = startReelSpin(i);
  }

  let result;
  try {
    result = await apiFetch("/api/play/slots", "POST", { bet });
  } catch(e) {
    showToast(e.message, "lose");
    for (let i = 0; i < 3; i++) clearInterval(intervals[i]);
    isSpinning = false; btn.disabled = false;
    msg.textContent = "";
    return;
  }

  const finalReels = result.reels;
  for (let i = 0; i < 3; i++) {
    await delay(350 + i * 300);
    clearInterval(intervals[i]);
    stopReel(i, finalReels[i]);
  }

  await delay(300);
  updateBalanceUI(result.new_balance, null);

  if (result.win_type === "triple") {
    msg.textContent = `🎉 ДЖЕКПОТ! +${fmtNum(result.win)} VBL`;
    msg.className = "slots-result-msg win-msg";
    showToast(`🎉 Тройное совпадение! +${fmtNum(result.win)} VBL`, "win");
    triggerWinEffect();
  } else if (result.win_type === "pair") {
    msg.textContent = `✨ Пара! +${fmtNum(result.win)} VBL`;
    msg.className = "slots-result-msg win-msg";
    showToast(`✨ Пара! +${fmtNum(result.win)} VBL`, "win");
  } else {
    msg.textContent = `😔 Мимо. −${fmtNum(bet)} VBL`;
    msg.className = "slots-result-msg lose-msg";
    showToast(`Не повезло. −${fmtNum(bet)} VBL`, "lose");
  }

  isSpinning = false;
  btn.disabled = false;
}

function startReelSpin(index) {
  const strip = document.getElementById("reel" + index);
  return setInterval(() => {
    if (strip.children[1]) strip.children[1].textContent = REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
    if (strip.children[0]) strip.children[0].textContent = REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
    if (strip.children[2]) strip.children[2].textContent = REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
  }, 60 + index * 20);
}

function stopReel(index, symbol) {
  const strip = document.getElementById("reel" + index);
  if (strip.children[0]) strip.children[0].textContent = REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
  if (strip.children[1]) strip.children[1].textContent = symbol;
  if (strip.children[2]) strip.children[2].textContent = REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)];
  strip.style.filter = "brightness(1.6)";
  setTimeout(() => { strip.style.filter = ""; }, 200);
}

function triggerWinEffect() {
  const frame = document.querySelector(".slots-frame");
  if (!frame) return;
  frame.style.boxShadow = "0 0 50px rgba(240,192,64,0.8)";
  frame.style.borderColor = "var(--gold)";
  setTimeout(() => {
    frame.style.boxShadow = "";
    frame.style.borderColor = "";
  }, 1200);
}

// ══════════════════════════════════════════
//  DICE (CSS 3D)
// ══════════════════════════════════════════

const DICE_ROTATIONS = {
  1: { x: 0,   y: 0   },
  2: { x: -90, y: 0   },
  3: { x: 0,   y: 90  },
  4: { x: 0,   y: -90 },
  5: { x: 90,  y: 0   },
  6: { x: 0,   y: 180 },
};

let diceCurrentX = 0;
let diceCurrentY = 0;

function initDice() {
  diceChosen = null;
  diceCurrentX = 0;
  diceCurrentY = 0;
  document.querySelectorAll(".dice-num-btn").forEach(b => b.classList.remove("selected"));
  document.getElementById("diceResultMsg").textContent = "";
  document.getElementById("diceResultMsg").className = "slots-result-msg";
  document.getElementById("diceResultDisplay").textContent = "?";

  const cube = document.getElementById("diceCube");
  cube.style.transition = "none";
  cube.style.transform = "rotateX(0deg) rotateY(0deg)";
}

function chooseDiceNum(btn, num) {
  diceChosen = num;
  document.querySelectorAll(".dice-num-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function changeDiceBet(delta) {
  const inp = document.getElementById("diceBet");
  inp.value = Math.max(10, Math.min(100000, Number(inp.value) + delta));
}
function setDiceBet(val) { document.getElementById("diceBet").value = val; }

async function playDiceGame() {
  if (isSpinning) return;
  if (diceChosen === null) { showToast("Выбери число от 1 до 6!", "info"); return; }
  const bet = Number(document.getElementById("diceBet").value);
  if (!bet || bet < 10) { showToast("Минимальная ставка: 10 VBL", "info"); return; }
  if (bet > balance)    { showToast("Недостаточно VBL-Coins!", "lose"); return; }

  isSpinning = true;
  const btn = document.getElementById("diceRollBtn");
  btn.disabled = true;

  const msg = document.getElementById("diceResultMsg");
  msg.textContent = "🎲 Бросаем...";
  msg.className = "slots-result-msg";
  document.getElementById("diceResultDisplay").textContent = "";

  // Хаотичное вращение пока ждём сервер
  const cube = document.getElementById("diceCube");
  const spinX = diceCurrentX + 360 * (3 + Math.floor(Math.random() * 3));
  const spinY = diceCurrentY + 360 * (3 + Math.floor(Math.random() * 3));
  cube.style.transition = "transform 0.8s ease-in";
  cube.style.transform  = `rotateX(${spinX}deg) rotateY(${spinY}deg)`;

  let result;
  try {
    result = await apiFetch("/api/play/dice", "POST", { bet, chosen: diceChosen });
  } catch(e) {
    showToast(e.message, "lose");
    isSpinning = false; btn.disabled = false;
    msg.textContent = "";
    return;
  }

  // Финальный угол: базовый + много оборотов для драмы
  const base   = DICE_ROTATIONS[result.result];
  const extraX = 360 * (4 + Math.floor(Math.random() * 3));
  const extraY = 360 * (4 + Math.floor(Math.random() * 3));
  const finalX = base.x + extraX;
  const finalY = base.y + extraY;

  cube.style.transition = "transform 2s cubic-bezier(0.25, 0.1, 0.25, 1)";
  cube.style.transform  = `rotateX(${finalX}deg) rotateY(${finalY}deg)`;
  diceCurrentX = finalX;
  diceCurrentY = finalY;

  await delay(2100);

  document.getElementById("diceResultDisplay").textContent = result.result;
  updateBalanceUI(result.new_balance, null);

  if (result.won) {
    msg.textContent = `🎉 Угадал! +${fmtNum(result.win)} VBL`;
    msg.className = "slots-result-msg win-msg";
    showToast(`🎉 Угадал ${result.result}! +${fmtNum(result.win)} VBL`, "win");
  } else {
    msg.textContent = `😔 Выпало ${result.result}. −${fmtNum(bet)} VBL`;
    msg.className = "slots-result-msg lose-msg";
    showToast(`Выпало ${result.result}, не ${diceChosen}. −${fmtNum(bet)} VBL`, "lose");
  }

  isSpinning = false;
  btn.disabled = false;
}

// ══════════════════════════════════════════
//  ROULETTE (Canvas wheel)
// ══════════════════════════════════════════

let rouletteAngle = 0;
let rouletteAnimFrame = null;
let rouletteSpinning = false;

const ROULETTE_NUMBERS = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,
  5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];
const RED_SET = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function numColor(n) {
  if (n === 0) return "#2ECC71";
  return RED_SET.has(n) ? "#C0392B" : "#2C2C3E";
}

function initRoulette() {
  rouletteBetType  = null;
  rouletteBetValue = null;
  document.getElementById("rouletteResult").textContent = "?";
  document.getElementById("rouletteResultMsg").textContent = "";
  document.getElementById("rouletteResultMsg").className = "slots-result-msg";
  document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("selected"));
  document.getElementById("rouletteNumber").value = "";
  drawRouletteWheel(0);
}

function drawRouletteWheel(angle) {
  const canvas = document.getElementById("rouletteCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2;
  const R = Math.min(W,H)/2 - 6;
  ctx.clearRect(0, 0, W, H);

  const count = ROULETTE_NUMBERS.length;
  const segAngle = (2 * Math.PI) / count;

  const grd = ctx.createRadialGradient(cx, cy, R-10, cx, cy, R+6);
  grd.addColorStop(0, "rgba(155,89,255,0.3)");
  grd.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(cx, cy, R+6, 0, 2*Math.PI);
  ctx.fillStyle = grd;
  ctx.fill();

  for (let i = 0; i < count; i++) {
    const startA = angle + i * segAngle - Math.PI / 2;
    const endA   = startA + segAngle;
    const num    = ROULETTE_NUMBERS[i];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, startA, endA);
    ctx.closePath();
    ctx.fillStyle = numColor(num);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startA + segAngle / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${R > 100 ? 9 : 7}px Inter`;
    ctx.fillText(num, R - 6, 3);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.22, 0, 2*Math.PI);
  const cGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.22);
  cGrd.addColorStop(0, "#2A1A4A");
  cGrd.addColorStop(1, "#14102A");
  ctx.fillStyle = cGrd;
  ctx.fill();
  ctx.strokeStyle = "rgba(155,89,255,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(240,192,64,0.9)";
  ctx.font = "bold 11px Rajdhani, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VBL", cx, cy);

  ctx.beginPath();
  ctx.moveTo(cx, cy - R + 2);
  ctx.lineTo(cx - 7, cy - R - 14);
  ctx.lineTo(cx + 7, cy - R - 14);
  ctx.closePath();
  ctx.fillStyle = "#F0C040";
  ctx.fill();
}

function setRouletteColor(color) {
  rouletteBetType  = "color";
  rouletteBetValue = color;
  document.getElementById("rouletteNumber").value = "";
  document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("selected"));
  document.getElementById("bet" + color.charAt(0).toUpperCase() + color.slice(1)).classList.add("selected");
}

function setRouletteNumber(val) {
  const n = parseInt(val);
  if (!isNaN(n) && n >= 0 && n <= 36) {
    rouletteBetType  = "number";
    rouletteBetValue = n;
    document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("selected"));
  }
}

function changeRouletteBet(delta) {
  const inp = document.getElementById("rouletteBet");
  inp.value = Math.max(10, Math.min(100000, Number(inp.value) + delta));
}

async function playRouletteGame() {
  if (isSpinning) return;
  if (!rouletteBetType) { showToast("Выбери ставку (цвет или число)!", "info"); return; }
  const bet = Number(document.getElementById("rouletteBet").value);
  if (!bet || bet < 10) { showToast("Минимальная ставка: 10 VBL", "info"); return; }
  if (bet > balance)    { showToast("Недостаточно VBL-Coins!", "lose"); return; }

  isSpinning = true;
  const btn = document.getElementById("rouletteSpinBtn");
  btn.disabled = true;
  document.getElementById("rouletteResult").textContent = "";

  const msg = document.getElementById("rouletteResultMsg");
  msg.textContent = "🎡 Крутим...";
  msg.className = "slots-result-msg";

  rouletteSpinning = true;
  function spinFrame() {
    if (!rouletteSpinning) return;
    rouletteAngle += 0.22 + Math.random() * 0.1;
    drawRouletteWheel(rouletteAngle);
    rouletteAnimFrame = requestAnimationFrame(spinFrame);
  }
  spinFrame();

  let result;
  try {
    result = await apiFetch("/api/play/roulette", "POST", {
      bet,
      bet_type: rouletteBetType,
      bet_value: rouletteBetValue,
    });
  } catch(e) {
    showToast(e.message, "lose");
    rouletteSpinning = false;
    isSpinning = false; btn.disabled = false;
    return;
  }

  await delay(600);
  const targetIdx = ROULETTE_NUMBERS.indexOf(result.spin_result);
  const segAngle  = (2 * Math.PI) / ROULETTE_NUMBERS.length;
  const sectorCenter = targetIdx * segAngle;
  let stopAngle = -Math.PI / 2 - sectorCenter + segAngle * 9;
  while (stopAngle < rouletteAngle) stopAngle += 2 * Math.PI;
  const targetAngle = stopAngle + 2 * Math.PI * 4;

  const startAngle = rouletteAngle;
  const duration   = 1400;
  const startTime  = performance.now();

  rouletteSpinning = false;
  if (rouletteAnimFrame) cancelAnimationFrame(rouletteAnimFrame);

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function decelFrame(now) {
    const t = Math.min(1, (now - startTime) / duration);
    rouletteAngle = startAngle + (targetAngle - startAngle) * easeOut(t);
    drawRouletteWheel(rouletteAngle);

    if (t < 1) {
      rouletteAnimFrame = requestAnimationFrame(decelFrame);
    } else { rouletteAngle = 0;
      const colorLabel = result.result_color === "red" ? "🔴" : result.result_color === "black" ? "⚫" : "🟢";
      document.getElementById("rouletteResult").textContent = result.spin_result;
      document.getElementById("rouletteResult").style.color =
        result.result_color === "red" ? "#E74C3C" : result.result_color === "green" ? "#2ECC71" : "#aaa";

      updateBalanceUI(result.new_balance, null);

      if (result.won) {
        msg.textContent = `🎉 Выиграл! +${fmtNum(result.win)} VBL`;
        msg.className = "slots-result-msg win-msg";
        showToast(`${colorLabel} ${result.spin_result} — Выиграл ×${result.multiplier}! +${fmtNum(result.win)} VBL`, "win");
      } else {
        msg.textContent = `😔 ${colorLabel} ${result.spin_result}. −${fmtNum(bet)} VBL`;
        msg.className = "slots-result-msg lose-msg";
        showToast(`${colorLabel} Выпало ${result.spin_result}. −${fmtNum(bet)} VBL`, "lose");
      }

      isSpinning = false;
      btn.disabled = false;
    }
  }
  requestAnimationFrame(decelFrame);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ══════════════════════════════════════════
//  MINES
// ══════════════════════════════════════════

let minesActive       = false;
let minesGridLocked   = false;
let minesOpened        = new Set();
let minesCount          = 3;
let minesCurrentMult   = 1.0;
let minesNextMult      = null;

async function initMines() {
  minesActive     = false;
  minesGridLocked = false;
  minesOpened     = new Set();
  minesCurrentMult = 1.0;
  minesNextMult    = null;

  renderMinesGrid();

  document.getElementById("minesResultMsg").textContent = "";
  document.getElementById("minesResultMsg").className = "slots-result-msg";
  document.getElementById("minesStartBtn").style.display = "block";
  document.getElementById("minesCashoutBtn").style.display = "none";
  document.getElementById("minesCashoutBtn").disabled = true;
  document.getElementById("minesMultDisplay").textContent = "x1.00";
  document.getElementById("minesCountInput").disabled = false;
  document.getElementById("minesBet").disabled = false;

  // Проверяем — вдруг есть незавершённая игра (например, после рестарта бэка/перезахода)
  try {
    const state = await apiFetch("/api/play/mines/state", "GET");
    if (state.active) {
      minesActive = true;
      minesCount  = state.mines_count;
      minesOpened = new Set(state.opened);
      minesCurrentMult = state.current_multiplier;
      minesNextMult    = state.next_multiplier;

      document.getElementById("minesBet").value = state.bet;
      document.getElementById("minesCountInput").value = state.mines_count;
      document.getElementById("minesCountInput").disabled = true;
      document.getElementById("minesBet").disabled = true;
      document.getElementById("minesStartBtn").style.display = "none";
      document.getElementById("minesCashoutBtn").style.display = "block";
      document.getElementById("minesCashoutBtn").disabled = false;
      document.getElementById("minesMultDisplay").textContent = `x${minesCurrentMult.toFixed(2)}`;

      minesOpened.forEach(i => {
        const c = document.querySelector(`.mines-cell[data-index="${i}"]`);
        if (c) { c.classList.add("mine-safe"); c.textContent = "💎"; }
      });

      const msg = document.getElementById("minesResultMsg");
      msg.textContent = "♻️ Незавершённая игра восстановлена.";
      msg.className = "slots-result-msg";
    }
  } catch(e) {
    console.error("[VBL] mines state check failed:", e.message);
  }
}

function renderMinesGrid() {
  const grid = document.getElementById("minesGrid");
  grid.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement("div");
    cell.className = "mines-cell";
    cell.dataset.index = i;
    cell.onclick = () => revealMineCell(i, cell);
    grid.appendChild(cell);
  }
}

function changeMinesBet(delta) {
  const inp = document.getElementById("minesBet");
  inp.value = Math.max(10, Math.min(100000, Number(inp.value) + delta));
}
function setMinesBet(val) { document.getElementById("minesBet").value = val; }

function changeMinesCount(delta) {
  const inp = document.getElementById("minesCountInput");
  inp.value = Math.max(1, Math.min(24, Number(inp.value) + delta));
}

async function startMinesGame() {
  if (minesActive) return;
  const bet = Number(document.getElementById("minesBet").value);
  const count = Number(document.getElementById("minesCountInput").value);
  if (!bet || bet < 10) { showToast("Минимальная ставка: 10 VBL", "info"); return; }
  if (bet > balance)    { showToast("Недостаточно VBL-Coins!", "lose"); return; }
  if (!(count >= 1 && count <= 24)) { showToast("Мин: от 1 до 24", "info"); return; }

  let result;
  try {
    result = await apiFetch("/api/play/mines/start", "POST", { bet, mines_count: count });
  } catch(e) {
    showToast(e.message, "lose");
    return;
  }

  minesActive = true;
  minesCount  = count;
  minesOpened = new Set();
  minesNextMult = result.next_multiplier;
  updateBalanceUI(result.new_balance, null);

  renderMinesGrid();   // ← полностью пересоздаём клетки: убираем mine-safe/mine-hit классы и старые onclick предыдущего раунда

  document.getElementById("minesStartBtn").style.display = "none";
  document.getElementById("minesCashoutBtn").style.display = "block";
  document.getElementById("minesCashoutBtn").disabled = false;
  document.getElementById("minesCountInput").disabled = true;
  document.getElementById("minesBet").disabled = true;
  document.getElementById("minesMultDisplay").textContent = "x1.00";

  const msg = document.getElementById("minesResultMsg");
  msg.textContent = `💣 ${count} мин на поле. Жми клетки!`;
  msg.className = "slots-result-msg";
}

async function revealMineCell(index, cellEl) {
  if (!minesActive || minesGridLocked) return;
  if (minesOpened.has(index)) return;

  minesGridLocked = true;
  let result;
  try {
    result = await apiFetch("/api/play/mines/reveal", "POST", { cell: index });
  } catch(e) {
    showToast(e.message, "lose");
    minesGridLocked = false;
    return;
  }

  if (result.status === "boom") {
    cellEl.classList.add("mine-hit");
    cellEl.textContent = "💥";
    result.mines.forEach(i => {
      const c = document.querySelector(`.mines-cell[data-index="${i}"]`);
      if (c && i !== index) { c.classList.add("mine-revealed"); c.textContent = "💣"; }
    });
    document.querySelectorAll(".mines-cell").forEach(c => c.onclick = null);

    const msg = document.getElementById("minesResultMsg");
    msg.textContent = "💥 Бум! Ты подорвался.";
    msg.className = "slots-result-msg lose-msg";
    showToast("💥 Мина! Ставка потеряна.", "lose");

    minesActive = false;
    document.getElementById("minesCashoutBtn").style.display = "none";
    document.getElementById("minesStartBtn").style.display = "block";
    document.getElementById("minesCountInput").disabled = false;
    document.getElementById("minesBet").disabled = false;
    minesGridLocked = false;
    return;
  }

  minesOpened.add(index);
  cellEl.classList.add("mine-safe");
  cellEl.textContent = "💎";
  minesCurrentMult = result.current_multiplier;
  minesNextMult    = result.next_multiplier;

  document.getElementById("minesMultDisplay").textContent = `x${minesCurrentMult.toFixed(2)}`;

  const msg = document.getElementById("minesResultMsg");
  if (result.all_safe_opened) {
    msg.textContent = "🏆 Все безопасные клетки открыты! Забирай выигрыш.";
    msg.className = "slots-result-msg win-msg";
  } else {
    msg.textContent = `✨ Безопасно! Следующая: x${minesNextMult.toFixed(2)}`;
    msg.className = "slots-result-msg";
  }

  minesGridLocked = false;
}

async function cashoutMines() {
  if (!minesActive) return;
  document.getElementById("minesCashoutBtn").disabled = true;

  let result;
  try {
    result = await apiFetch("/api/play/mines/cashout", "POST", {});
  } catch(e) {
    showToast(e.message, "lose");
    document.getElementById("minesCashoutBtn").disabled = false;
    return;
  }

  minesActive = false;
  updateBalanceUI(result.new_balance, null);
  document.querySelectorAll(".mines-cell").forEach(c => c.onclick = null);

  // Показываем где были мины — игрок должен видеть, что реально стояло на поле
  (result.mines || []).forEach(i => {
    const c = document.querySelector(`.mines-cell[data-index="${i}"]`);
    if (c && !c.classList.contains("mine-safe")) {
      c.classList.add("mine-revealed");
      c.textContent = "💣";
    }
  });

  const msg = document.getElementById("minesResultMsg");
  msg.textContent = `💰 Забрал x${result.multiplier.toFixed(2)}! +${fmtNum(result.win)} VBL`;
  msg.className = "slots-result-msg win-msg";
  showToast(`💰 +${fmtNum(result.win)} VBL (x${result.multiplier.toFixed(2)})`, "win");

  document.getElementById("minesCashoutBtn").style.display = "none";
  document.getElementById("minesStartBtn").style.display = "block";
  document.getElementById("minesCountInput").disabled = false;
  document.getElementById("minesBet").disabled = false;
}

init();

// ══════════════════════════════════════════
//  DAILY BONUS + TOPUP
// ══════════════════════════════════════════

let bonusStatusCache = null;
let topupStatusCache = null;
let bonusCountdownTimer = null;

function fmtClock(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}ч ${m}м`;
}

async function fetchBonusStatus() {
  try {
    const res = await apiFetch("/api/bonus/status", "GET");
    bonusStatusCache = res.bonus;
    topupStatusCache = res.topup;
    renderBonusBanner();
  } catch (e) {
    console.error("[VBL] bonus status failed:", e.message);
  }
}

function renderBonusBanner() {
  const titleEl = document.getElementById("bonusBannerTitle");
  const subEl   = document.getElementById("bonusBannerSub");
  if (!titleEl || !bonusStatusCache) return;

  clearInterval(bonusCountdownTimer);

  if (bonusStatusCache.ready) {
    titleEl.textContent = `🎁 Бонус готов: +${fmtNum(bonusStatusCache.next_amount)} VBL`;
    subEl.textContent = `🔥 Серия: день ${bonusStatusCache.next_streak_day}`;
  } else {
    let remaining = bonusStatusCache.remaining_seconds || 0;
    titleEl.textContent = "🎁 Следующий бонус через";
    subEl.textContent = fmtClock(remaining);
    bonusCountdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(bonusCountdownTimer);
        fetchBonusStatus();
        return;
      }
      subEl.textContent = fmtClock(remaining);
    }, 1000);
  }

  // Subtle hint on the banner itself if a top-up is currently available
  const banner = document.getElementById("bonusBanner");
  if (topupStatusCache && topupStatusCache.eligible) {
    banner.classList.add("has-topup");
  } else {
    banner.classList.remove("has-topup");
  }
}

function openBonusPanel() {
  document.getElementById("bonusModal").classList.add("show");
  renderBonusModal();
}

function closeBonusPanel() {
  document.getElementById("bonusModal").classList.remove("show");
}

function renderBonusModal() {
  const amountEl = document.getElementById("bonusModalAmount");
  const streakEl = document.getElementById("bonusStreakRow");
  const claimBtn = document.getElementById("bonusClaimBtn");

  if (bonusStatusCache) {
    if (bonusStatusCache.ready) {
      amountEl.textContent = `+${fmtNum(bonusStatusCache.next_amount)} VBL`;
      claimBtn.disabled = false;
      claimBtn.querySelector(".spin-btn-text").textContent = "ЗАБРАТЬ БОНУС";
    } else {
      amountEl.textContent = `Доступен через ${fmtClock(bonusStatusCache.remaining_seconds || 0)}`;
      claimBtn.disabled = true;
      claimBtn.querySelector(".spin-btn-text").textContent = "ПОКА НЕДОСТУПНО";
    }
    const dayLabels = [1,2,3,4,5,6,7].map(d => {
      const active = d <= bonusStatusCache.next_streak_day;
      return `<span class="bonus-day ${active ? "active" : ""}">${d}</span>`;
    }).join("");
    streakEl.innerHTML = dayLabels;
  }

  const topupBlock = document.getElementById("topupBlock");
  const topupBtn = document.getElementById("topupClaimBtn");
  document.getElementById("topupAmountLabel").textContent = topupStatusCache ? topupStatusCache.amount : "";
  if (topupStatusCache && topupStatusCache.eligible) {
    topupBlock.style.display = "block";
    topupBtn.disabled = false;
  } else if (topupStatusCache && topupStatusCache.amount && (balance < topupStatusCache.threshold)) {
    topupBlock.style.display = "block";
    topupBtn.disabled = true;
  } else {
    topupBlock.style.display = "none";
  }
}

async function claimDailyBonus() {
  const btn = document.getElementById("bonusClaimBtn");
  btn.disabled = true;
  try {
    const result = await apiFetch("/api/bonus/claim", "POST", {});
    updateBalanceUI(result.new_balance, null);
    showToast(`🎁 +${fmtNum(result.amount)} VBL — серия день ${result.streak}!`, "win");
    await fetchBonusStatus();
    renderBonusModal();
  } catch (e) {
    showToast(e.message, "lose");
    btn.disabled = false;
  }
}

async function claimTopup() {
  const btn = document.getElementById("topupClaimBtn");
  btn.disabled = true;
  try {
    const result = await apiFetch("/api/topup/claim", "POST", {});
    updateBalanceUI(result.new_balance, null);
    showToast(`💧 Подзарядка: +${fmtNum(result.amount)} VBL`, "win");
    await fetchBonusStatus();
    renderBonusModal();
  } catch (e) {
    showToast(e.message, "lose");
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════
//  VIDEO POKER
// ══════════════════════════════════════════

let pokerActive = false;
let pokerLocked = false;
let pokerHolds  = [false, false, false, false, false];

const POKER_SUIT_SYMBOL = { "♠": "♠", "♥": "♥", "♦": "♦", "♣": "♣" };
const POKER_HAND_LABELS = {
  royal_flush: "👑 РОЯЛ-ФЛЕШ!",
  straight_flush: "Стрит-флеш!",
  four_kind: "Каре!",
  full_house: "Фулл-хаус!",
  flush: "Флеш!",
  straight: "Стрит!",
  three_kind: "Сет!",
  two_pair: "Две пары!",
  jacks_or_better: "Пара В-В и выше!",
  nothing: "Мимо",
};

function pokerCardEl(card) {
  const el = document.createElement("div");
  const [rank, suit] = card;
  const isRed = (suit === "♥" || suit === "♦");
  el.className = "poker-card" + (isRed ? " poker-card-red" : "");
  el.innerHTML = `
    <span class="poker-card-corner">${rank}<br>${suit}</span>
    <span class="poker-card-suit-big">${suit}</span>
  `;
  return el;
}

function initPoker() {
  pokerActive = false;
  pokerLocked = false;
  pokerHolds = [false, false, false, false, false];
  document.querySelectorAll(".poker-card-slot").forEach(slot => {
    slot.innerHTML = `<div class="poker-card-back">🂠</div>`;
  });
  document.querySelectorAll(".poker-hold-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("pokerHoldRow").style.display = "none";
  document.getElementById("pokerResultMsg").textContent = "";
  document.getElementById("pokerResultMsg").className = "slots-result-msg";
  document.getElementById("pokerDealBtn").style.display = "block";
  document.getElementById("pokerDrawBtn").style.display = "none";
  document.getElementById("pokerBet").disabled = false;

  apiFetch("/api/play/poker/state", "GET").then(state => {
    if (state.active) {
      pokerActive = true;
      document.getElementById("pokerBet").value = state.bet;
      document.getElementById("pokerBet").disabled = true;
      document.getElementById("pokerDealBtn").style.display = "none";
      document.getElementById("pokerDrawBtn").style.display = "block";
      document.getElementById("pokerHoldRow").style.display = "flex";
      pokerRenderHand(state.hand);
      const msg = document.getElementById("pokerResultMsg");
      msg.textContent = "♻️ Незавершённая раздача восстановлена. Выбери карты для замены.";
      msg.className = "slots-result-msg";
    }
  }).catch(e => console.error("[VBL] poker state check failed:", e.message));
}

function pokerRenderHand(hand) {
  hand.forEach((card, i) => {
    const slot = document.querySelector(`.poker-card-slot[data-i="${i}"]`);
    slot.innerHTML = "";
    slot.appendChild(pokerCardEl(card));
  });
}

function changePokerBet(delta) {
  const inp = document.getElementById("pokerBet");
  inp.value = Math.max(10, Math.min(100000, Number(inp.value) + delta));
}
function setPokerBet(val) { document.getElementById("pokerBet").value = val; }

function togglePokerHold(i) {
  if (!pokerActive || pokerLocked) return;
  pokerHolds[i] = !pokerHolds[i];
  const btn = document.querySelector(`.poker-hold-btn[data-i="${i}"]`);
  const slot = document.querySelector(`.poker-card-slot[data-i="${i}"]`);
  btn.classList.toggle("active", pokerHolds[i]);
  slot.classList.toggle("held", pokerHolds[i]);
}

async function dealPoker() {
  if (pokerActive) return;
  const bet = Number(document.getElementById("pokerBet").value);
  if (!bet || bet < 10) { showToast("Минимальная ставка: 10 VBL", "info"); return; }
  if (bet > balance)    { showToast("Недостаточно VBL-Coins!", "lose"); return; }

  let result;
  try {
    result = await apiFetch("/api/play/poker/deal", "POST", { bet });
  } catch (e) {
    showToast(e.message, "lose");
    return;
  }

  pokerActive = true;
  pokerHolds = [false, false, false, false, false];
  document.querySelectorAll(".poker-hold-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".poker-card-slot").forEach(s => s.classList.remove("held"));

  updateBalanceUI(result.new_balance, null);
  pokerRenderHand(result.hand);

  document.getElementById("pokerBet").disabled = true;
  document.getElementById("pokerDealBtn").style.display = "none";
  document.getElementById("pokerDrawBtn").style.display = "block";
  document.getElementById("pokerHoldRow").style.display = "flex";

  const msg = document.getElementById("pokerResultMsg");
  msg.textContent = "Выбери карты, которые хочешь оставить, и нажми «Заменить»";
  msg.className = "slots-result-msg";
}

async function drawPoker() {
  if (!pokerActive || pokerLocked) return;
  pokerLocked = true;
  const betForMsg = Number(document.getElementById("pokerBet").value);

  let result;
  try {
    result = await apiFetch("/api/play/poker/draw", "POST", { holds: pokerHolds });
  } catch (e) {
    showToast(e.message, "lose");
    pokerLocked = false;
    return;
  }

  pokerActive = false;
  pokerRenderHand(result.hand);
  updateBalanceUI(result.new_balance, null);

  const msg = document.getElementById("pokerResultMsg");
  const label = POKER_HAND_LABELS[result.hand_name] || result.hand_name;
  if (result.win > 0) {
    msg.textContent = `🎉 ${label} +${fmtNum(result.win)} VBL (×${result.multiplier})`;
    msg.className = "slots-result-msg win-msg";
    showToast(`🎉 ${label} +${fmtNum(result.win)} VBL`, "win");
  } else {
    msg.textContent = `😔 ${label}. −${fmtNum(betForMsg)} VBL`;
    msg.className = "slots-result-msg lose-msg";
    showToast(`Не повезло. −${fmtNum(betForMsg)} VBL`, "lose");
  }

  document.getElementById("pokerDrawBtn").style.display = "none";
  document.getElementById("pokerDealBtn").style.display = "block";
  document.getElementById("pokerHoldRow").style.display = "none";
  document.getElementById("pokerBet").disabled = false;
  pokerLocked = false;
}

// ══════════════════════════════════════════
//  BLACKJACK
// ══════════════════════════════════════════

let bjActive  = false;
let bjLocked  = false;

function bjCardEl(card, hidden = false) {
  const el = document.createElement("div");
  if (hidden) {
    el.className = "bj-card bj-card-back";
    return el;
  }
  const [rank, suit] = card;
  const isRed = (suit === "♥" || suit === "♦");
  el.className = "bj-card" + (isRed ? " bj-card-red" : "");
  el.innerHTML = `
    <span class="bj-card-corner bj-card-corner-tl">${rank}<br>${suit}</span>
    <span class="bj-card-suit-big">${suit}</span>
    <span class="bj-card-corner bj-card-corner-br">${rank}<br>${suit}</span>
  `;
  return el;
}

function bjRenderHands(playerCards, dealerCards, dealerHidden) {
  const pEl = document.getElementById("bjPlayerCards");
  const dEl = document.getElementById("bjDealerCards");
  pEl.innerHTML = "";
  dEl.innerHTML = "";
  playerCards.forEach(c => pEl.appendChild(bjCardEl(c)));
  if (dealerHidden) {
    dEl.appendChild(bjCardEl(dealerCards[0]));
    dEl.appendChild(bjCardEl(null, true));
  } else {
    dealerCards.forEach(c => dEl.appendChild(bjCardEl(c)));
  }
}

async function initBlackjack() {
  bjActive = false;
  bjLocked = false;
  document.getElementById("bjPlayerCards").innerHTML = "";
  document.getElementById("bjDealerCards").innerHTML = "";
  document.getElementById("bjPlayerTotal").textContent = "";
  document.getElementById("bjDealerTotal").textContent = "";
  document.getElementById("bjResultMsg").textContent = "";
  document.getElementById("bjResultMsg").className = "slots-result-msg";
  document.getElementById("bjStartBtn").style.display = "block";
  document.getElementById("bjActions").style.display = "none";
  document.getElementById("bjBet").disabled = false;

  try {
    const state = await apiFetch("/api/play/blackjack/state", "GET");
    if (state.active) {
      bjActive = true;
      document.getElementById("bjBet").value = state.bet;
      document.getElementById("bjBet").disabled = true;
      document.getElementById("bjStartBtn").style.display = "none";
      document.getElementById("bjActions").style.display = "flex";
      bjRenderHands(state.player, [state.dealer_up], true);
      document.getElementById("bjPlayerTotal").textContent = `Игрок: ${state.player_total}`;
      document.getElementById("bjDealerTotal").textContent = `Дилер: ${bjCardValueDisplay(state.dealer_up)} + ?`;
      const msg = document.getElementById("bjResultMsg");
      msg.textContent = "♻️ Незавершённая раздача восстановлена.";
      msg.className = "slots-result-msg";
    }
  } catch(e) {
    console.error("[VBL] blackjack state check failed:", e.message);
  }
}

function bjCardValueDisplay(card) {
  return card[0];
}

function changeBjBet(delta) {
  const inp = document.getElementById("bjBet");
  inp.value = Math.max(10, Math.min(100000, Number(inp.value) + delta));
}
function setBjBet(val) { document.getElementById("bjBet").value = val; }

function bjShowFinal(result, betForMsg) {
  bjActive = false;
  bjRenderHands(result.player, result.dealer, false);
  document.getElementById("bjPlayerTotal").textContent = `Игрок: ${result.player_total}`;
  document.getElementById("bjDealerTotal").textContent = `Дилер: ${result.dealer_total}`;
  updateBalanceUI(result.new_balance, null);

  const msg = document.getElementById("bjResultMsg");
  if (result.outcome === "blackjack") {
    msg.textContent = `🎉 БЛЭКДЖЕК! +${fmtNum(result.win)} VBL`;
    msg.className = "slots-result-msg win-msg";
    showToast(`🎉 Блэкджек! +${fmtNum(result.win)} VBL`, "win");
  } else if (result.outcome === "win") {
    msg.textContent = `🎉 Победа! +${fmtNum(result.win)} VBL`;
    msg.className = "slots-result-msg win-msg";
    showToast(`🎉 Победа! +${fmtNum(result.win)} VBL`, "win");
  } else if (result.outcome === "push") {
    msg.textContent = `🤝 Ничья. Ставка возвращена.`;
    msg.className = "slots-result-msg";
    showToast(`🤝 Ничья — ставка возвращена`, "info");
  } else {
    msg.textContent = `😔 Проигрыш. −${fmtNum(betForMsg)} VBL`;
    msg.className = "slots-result-msg lose-msg";
    showToast(`Проигрыш. −${fmtNum(betForMsg)} VBL`, "lose");
  }

  document.getElementById("bjActions").style.display = "none";
  document.getElementById("bjStartBtn").style.display = "block";
  document.getElementById("bjBet").disabled = false;
}

async function startBlackjackGame() {
  if (bjActive) return;
  const bet = Number(document.getElementById("bjBet").value);
  if (!bet || bet < 10) { showToast("Минимальная ставка: 10 VBL", "info"); return; }
  if (bet > balance)    { showToast("Недостаточно VBL-Coins!", "lose"); return; }

  let result;
  try {
    result = await apiFetch("/api/play/blackjack/start", "POST", { bet });
  } catch(e) {
    showToast(e.message, "lose");
    return;
  }

  document.getElementById("bjBet").disabled = true;
  document.getElementById("bjStartBtn").style.display = "none";

  if (result.status === "finished") {
    // Натуральный блэкджек у игрока — раздача сразу завершена
    bjActive = false;
    bjShowFinal(result, bet);
    return;
  }

  bjActive = true;
  updateBalanceUI(result.new_balance, null);
  bjRenderHands(result.player, [result.dealer_up], true);
  document.getElementById("bjPlayerTotal").textContent = `Игрок: ${result.player_total}`;
  document.getElementById("bjDealerTotal").textContent = `Дилер: ${bjCardValueDisplay(result.dealer_up)} + ?`;
  document.getElementById("bjActions").style.display = "flex";

  const msg = document.getElementById("bjResultMsg");
  msg.textContent = "Хит или стенд?";
  msg.className = "slots-result-msg";
}

async function bjHit() {
  if (!bjActive || bjLocked) return;
  bjLocked = true;
  const bet = Number(document.getElementById("bjBet").value);

  let result;
  try {
    result = await apiFetch("/api/play/blackjack/hit", "POST", {});
  } catch(e) {
    showToast(e.message, "lose");
    bjLocked = false;
    return;
  }

  if (result.status === "finished") {
    bjShowFinal(result, bet);
    bjLocked = false;
    return;
  }

  const pEl = document.getElementById("bjPlayerCards");
  pEl.innerHTML = "";
  result.player.forEach(c => pEl.appendChild(bjCardEl(c)));
  document.getElementById("bjPlayerTotal").textContent = `Игрок: ${result.player_total}`;

  bjLocked = false;
}

async function bjStand() {
  if (!bjActive || bjLocked) return;
  bjLocked = true;
  const bet = Number(document.getElementById("bjBet").value);

  let result;
  try {
    result = await apiFetch("/api/play/blackjack/stand", "POST", {});
  } catch(e) {
    showToast(e.message, "lose");
    bjLocked = false;
    return;
  }

  bjShowFinal(result, bet);
  bjLocked = false;
}

// ══════════════════════════════════════════
//  CRASH (Ракетка) — real multiplayer round
// ══════════════════════════════════════════

const CRASH_K = 0.13; // должно совпадать с CRASH_K на бэкенде

let crashPollTimer   = null;
let crashAnimFrame    = null;
let crashState         = null;   // последнее состояние с сервера
let crashLocalElapsed0 = 0;      // performance.now() в момент последнего sync для phase=flying
let crashServerElapsed0 = 0;     // elapsed (сек) на сервере в момент последнего sync
let crashMyBetThisRound = false;
let crashCashedOutThisRound = false;
let crashParticles = [];
let crashShakeUntil = 0;
let crashCanvasReady = false;

function initCrash() {
  const canvas = document.getElementById("crashCanvas");
  resizeCrashCanvas();
  window.addEventListener("resize", resizeCrashCanvas);
  crashCanvasReady = true;
  crashParticles = [];

  document.getElementById("crashBet").value = document.getElementById("crashBet").value || 100;

  crashPollOnce();
  crashPollTimer = setInterval(crashPollOnce, 450);
  if (!crashAnimFrame) crashAnimFrame = requestAnimationFrame(crashRenderLoop);
}

function stopCrash() {
  if (crashPollTimer) { clearInterval(crashPollTimer); crashPollTimer = null; }
  if (crashAnimFrame) { cancelAnimationFrame(crashAnimFrame); crashAnimFrame = null; }
  window.removeEventListener("resize", resizeCrashCanvas);
}

function resizeCrashCanvas() {
  const canvas = document.getElementById("crashCanvas");
  if (!canvas) return;
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = wrap.clientWidth * dpr;
  canvas.height = wrap.clientHeight * dpr;
  canvas.style.width  = wrap.clientWidth + "px";
  canvas.style.height = wrap.clientHeight + "px";
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setCrashBetMode(mode) {
  const inp = document.getElementById("crashBet");
  if (mode === "min") {
    inp.value = 10;
  } else if (mode === "max") {
    inp.value = Math.max(10, Math.floor(balance));
  }
}
function setCrashBet(val) { document.getElementById("crashBet").value = val; }

async function crashPollOnce() {
  let state;
  try {
    state = await apiFetch("/api/play/crash/state", "GET");
  } catch (e) {
    console.error("[VBL] crash poll failed:", e.message);
    return;
  }

  const prevRoundId = crashState ? crashState.round_id : null;
  crashState = state;

  if (state.phase === "flying") {
    crashServerElapsed0 = state.elapsed || 0;
    crashLocalElapsed0  = performance.now();
  }

  if (prevRoundId !== null && state.round_id !== prevRoundId) {
    // новый раунд начался — сбрасываем локальный флаг ставки
    crashMyBetThisRound = false;
    crashCashedOutThisRound = false;
    crashAutoTriggered = false;
    crashParticles = [];
  }

  if (state.my_bet) {
    crashMyBetThisRound = true;
    crashCashedOutThisRound = !!state.my_bet.cashed_out;
  } else {
    crashMyBetThisRound = false;
    crashCashedOutThisRound = false;
  }

  if (state.phase === "crashed" && !crashShakeWasTriggered) {
    triggerCrashShake();
    crashShakeWasTriggered = true;
  }
  if (state.phase !== "crashed") crashShakeWasTriggered = false;

  updateCrashUI(state);
}
let crashShakeWasTriggered = false;

function triggerCrashShake() {
  const wrap = document.querySelector(".crash-canvas-wrap");
  if (!wrap) return;
  wrap.classList.add("shake");
  setTimeout(() => wrap.classList.remove("shake"), 300);
  // взрыв частиц
  for (let i = 0; i < 26; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    crashParticles.push({
      x: 0.5, y: 0.5, // относительные координаты — пересчитаем при отрисовке
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, color: Math.random() > 0.5 ? "#F0C040" : "#E74C3C",
    });
  }
}

function crashLiveMultiplier() {
  if (!crashState) return 1.0;
  if (crashState.phase === "waiting") return 1.0;
  if (crashState.phase === "crashed") return crashState.crash_point || 1.0;
  // flying — интерполируем локально для плавности между поллами
  const extra = (performance.now() - crashLocalElapsed0) / 1000;
  const elapsed = crashServerElapsed0 + Math.max(0, extra);
  const mult = Math.exp(CRASH_K * elapsed);
  // не превышаем crash_point если уже известен
  if (crashState.crash_point) return Math.min(mult, crashState.crash_point);
  return mult;
}

function updateCrashUI(state) {
  const actionBtn  = document.getElementById("crashActionBtn");
  const actionText = document.getElementById("crashActionText");
  const actionSub  = document.getElementById("crashActionSub");
  const banner     = document.getElementById("crashPhaseBanner");

  if (state.phase === "waiting") {
    banner.textContent = `⏳ Ставки открыты: ${Math.ceil(state.waiting_remaining || 0)}с`;
    banner.className = "crash-phase-banner waiting";

    if (crashMyBetThisRound) {
      actionBtn.className = "spin-btn crash-action-btn mode-placed";
      actionBtn.disabled = true;
      actionText.textContent = "СТАВКА ПРИНЯТА";
      actionSub.textContent = "Жди старта раунда…";
    } else {
      actionBtn.className = "spin-btn crash-action-btn";
      actionBtn.disabled = false;
      actionText.textContent = "СДЕЛАТЬ СТАВКУ";
      actionSub.textContent = "Ставки принимаются…";
    }
  } else if (state.phase === "flying") {
    banner.textContent = "🚀 Полёт!";
    banner.className = "crash-phase-banner flying";

    if (crashMyBetThisRound && !crashCashedOutThisRound) {
      const bet = (crashState.my_bet && crashState.my_bet.bet) || 0;
      const liveWin = Math.floor(bet * crashLiveMultiplier());
      actionBtn.className = "spin-btn crash-action-btn mode-cashout";
      actionBtn.disabled = false;
      actionText.textContent = `ЗАБРАТЬ ${fmtNum(liveWin)} VBL`;
      actionSub.textContent = "Жми, пока не поздно!";
    } else if (crashMyBetThisRound && crashCashedOutThisRound) {
      actionBtn.className = "spin-btn crash-action-btn mode-placed";
      actionBtn.disabled = true;
      const m = crashState.my_bet.cashout_mult;
      actionText.textContent = `ЗАБРАЛ x${m ? m.toFixed(2) : "—"}`;
      actionSub.textContent = `+${fmtNum(crashState.my_bet.win || 0)} VBL`;
    } else {
      actionBtn.className = "spin-btn crash-action-btn mode-wait";
      actionBtn.disabled = true;
      actionText.textContent = "РАКЕТА ЛЕТИТ";
      actionSub.textContent = "Дождись следующего раунда";
    }
  } else if (state.phase === "crashed") {
    banner.textContent = `💥 Улетела на x${(state.crash_point || 1).toFixed(2)}`;
    banner.className = "crash-phase-banner crashed";

    actionBtn.className = "spin-btn crash-action-btn mode-wait";
    actionBtn.disabled = true;
    actionText.textContent = "РАУНД ЗАВЕРШЁН";
    actionSub.textContent = "Новый раунд скоро начнётся…";
  }

  renderCrashBoard(state);
  renderCrashHistory(state);
}

// ── Цветовые пороги множителя: <5 синий, 5–30 фиолетовый, 30–100 золотой, 100+ ядерно-красный ──
function crashTierClass(mult) {
  if (mult >= 100) return "tier-red";
  if (mult >= 30)  return "tier-gold";
  if (mult >= 5)   return "tier-violet";
  return "tier-blue";
}

function renderCrashHistory(state) {
  const box = document.getElementById("crashHistory");
  const hist = state.history || [];
  if (hist.length === 0) {
    box.innerHTML = '<div class="crash-history-empty">История раундов появится здесь…</div>';
    return;
  }
  box.innerHTML = hist.map(v =>
    `<div class="crash-history-pill ${crashTierClass(v)}">x${v.toFixed(2)}</div>`
  ).join("");
}

function renderCrashBoard(state) {
  const box = document.getElementById("crashBoardRows");
  const players = state.players || [];
  if (players.length === 0) {
    box.innerHTML = '<div class="crash-board-empty">Пока никто не поставил…</div>';
    return;
  }
  const myId = state.my_bet ? state.my_bet.user_id : null;
  box.innerHTML = players.map(p => {
    let resultHtml;
    if (p.status === "won") {
      resultHtml = `<span class="crash-board-status won">x${(p.cashout_mult || 0).toFixed(2)} · +${fmtNum(p.win || 0)}</span>`;
    } else if (p.status === "lost") {
      resultHtml = `<span class="crash-board-status lost">−${fmtNum(p.bet)}</span>`;
    } else {
      resultHtml = `<span class="crash-board-status playing">в игре…</span>`;
    }
    const isMe = myId && p.user_id === myId;
    return `<div class="crash-board-row${isMe ? " me" : ""}">
      <span class="crash-board-name">${escapeHtml(p.username || ("id" + p.user_id))}</span>
      <span class="crash-board-bet">${fmtNum(p.bet)}</span>
      ${resultHtml}
    </div>`;
  }).join("");
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

async function crashActionClick() {
  if (!crashState) return;

  if (crashState.phase === "waiting" && !crashMyBetThisRound) {
    const bet = Number(document.getElementById("crashBet").value);
    if (!bet || bet < 10) { showToast("Минимальная ставка: 10 VBL", "info"); return; }
    if (bet > balance) { showToast("Недостаточно VBL-Coins!", "lose"); return; }

    try {
      const autoEl = document.getElementById("crashAutoEnabled");
      const autoMult = (autoEl && autoEl.checked)
        ? parseFloat(document.getElementById("crashAutoMult").value) || null
        : null;
      const res = await apiFetch("/api/play/crash/bet", "POST", { bet, auto_cashout: autoMult });
      updateBalanceUI(res.new_balance, null);
      crashMyBetThisRound = true;
      showToast(`✅ Ставка ${fmtNum(bet)} VBL принята`, "info");
      crashPollOnce();
    } catch (e) {
      showToast(e.message, "lose");
    }
    return;
  }

  if (crashState.phase === "flying" && crashMyBetThisRound && !crashCashedOutThisRound) {
    try {
      const res = await apiFetch("/api/play/crash/cashout", "POST", {});
      updateBalanceUI(res.new_balance, null);
      crashCashedOutThisRound = true;
      showToast(`💰 Забрал x${res.multiplier.toFixed(2)}! +${fmtNum(res.win)} VBL`, "win");
      crashPollOnce();
    } catch (e) {
      showToast(e.message, "lose");
    }
  }
}

// ── Canvas rocket render loop ──

function crashRenderLoop() {
  crashAnimFrame = requestAnimationFrame(crashRenderLoop);
  if (!crashCanvasReady) return;
  const canvas = document.getElementById("crashCanvas");
  if (!canvas || !canvas.isConnected) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.clearRect(0, 0, W, H);

  // фон: космос + неоновая сетка
  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(155,89,255,0.08)";
  ctx.lineWidth = 1;
  const gridStep = 28;
  for (let x = W % gridStep; x < W; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = H % gridStep; y < H; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const phase = crashState ? crashState.phase : "waiting";
  const mult = crashLiveMultiplier();

  // обновляем текст множителя + цвет по порогу
  const multEl = document.getElementById("crashMultDisplay");
  if (multEl) {
    const shown = phase === "waiting" ? "1.00" : mult.toFixed(2);
    multEl.firstChild.nodeValue = shown;
    const tier = crashTierClass(phase === "waiting" ? 1 : mult);
    if (!multEl.classList.contains(tier)) {
      multEl.classList.remove("tier-blue", "tier-violet", "tier-gold", "tier-red");
      multEl.classList.add(tier);
    }
  }

  // позиция ракеты — нелинейная кривая (ускоряется к концу)
  const t = phase === "flying" ? Math.min(1, Math.log(Math.max(mult,1)) / Math.log(50)) : (phase === "crashed" ? 1 : 0);
  const originX = 24, originY = H - 24;
  const targetX = W - 36, targetY = 30;
  const progress = phase === "waiting" ? 0 : Math.min(1, t);
  // кривая Безье: прогиб вверх для эффекта траектории
  const curveX = originX + (targetX - originX) * progress;
  const curveY = originY - (originY - targetY) * Math.pow(progress, 0.7);

  if (phase === "flying" || phase === "waiting") {
    // светящаяся трасса
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.quadraticCurveTo(originX + (curveX - originX) * 0.5, originY, curveX, curveY);
    const grad = ctx.createLinearGradient(originX, originY, curveX, curveY);
    grad.addColorStop(0, "rgba(155,89,255,0.05)");
    grad.addColorStop(1, "rgba(155,89,255,0.9)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(155,89,255,0.8)";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // заливка под кривой
    ctx.lineTo(curveX, originY);
    ctx.lineTo(originX, originY);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, targetY, 0, originY);
    fillGrad.addColorStop(0, "rgba(155,89,255,0.16)");
    fillGrad.addColorStop(1, "rgba(155,89,255,0.0)");
    ctx.fillStyle = fillGrad;
    ctx.fill();
  }

  if (phase !== "crashed") {
    // покачивание + наклон ракеты по вектору
    const wobble = Math.sin(performance.now() / 220) * 4;
    const angle = -Math.atan2(targetY - originY, targetX - originX) * 0.55 - 0.5;

    // шлейф частиц из хвоста
    if (phase === "flying" && Math.random() < 0.7) {
      crashParticles.push({
        x: curveX - Math.cos(angle) * 14, y: curveY + Math.sin(angle) * 14 + wobble,
        vx: -1.5 - Math.random() * 1.5, vy: 1 + Math.random() * 1.5,
        life: 1, color: Math.random() > 0.4 ? "#9B59FF" : "#F0C040", trail: true,
      });
    }

    ctx.save();
    ctx.translate(curveX, curveY + wobble);
    ctx.rotate(angle);
    ctx.font = "26px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowBlur = 16; ctx.shadowColor = "rgba(155,89,255,0.9)";
    ctx.fillText("🚀", 0, 0);
    ctx.restore();
  }

  // частицы
  for (let i = crashParticles.length - 1; i >= 0; i--) {
    const p = crashParticles[i];
    if (p.trail) {
      p.x += p.vx; p.y += p.vy; p.life -= 0.035;
    } else {
      // взрыв-частицы используют относительные координаты от точки краша
      if (p.exploded === undefined) { p.ex = curveX; p.ey = curveY; p.exploded = true; }
      p.ex += p.vx; p.ey += p.vy; p.vy += 0.12; p.life -= 0.025;
    }
    if (p.life <= 0) { crashParticles.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    const px = p.trail ? p.x : p.ex;
    const py = p.trail ? p.y : p.ey;
    ctx.beginPath();
    ctx.arc(px, py, p.trail ? 2.5 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (phase === "crashed") {
    // финальная вспышка взрыва на застывшей позиции
    ctx.save();
    ctx.translate(curveX, curveY);
    const flashR = 26;
    const flashGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, flashR);
    flashGrad.addColorStop(0, "rgba(255,220,150,0.9)");
    flashGrad.addColorStop(0.5, "rgba(231,76,60,0.5)");
    flashGrad.addColorStop(1, "rgba(231,76,60,0)");
    ctx.fillStyle = flashGrad;
    ctx.beginPath(); ctx.arc(0, 0, flashR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}


// ══════════════════════════════════════════
//  PvP BLACKJACK 1v1
// ══════════════════════════════════════════

let pvpRoomId       = null;   // текущая комната
let pvpMyUid        = null;   // мой user_id (строка)
let pvpPhase        = null;   // "lobby" | "waiting" | "playing" | "finished"
let pvpPollTimer    = null;
let pvpLocked       = false;

function pvpShow(section) {
  document.getElementById("pvpLobby").style.display   = section === "lobby"   ? "" : "none";
  document.getElementById("pvpWaiting").style.display = section === "waiting" ? "" : "none";
  document.getElementById("pvpGame").style.display    = section === "game"    ? "" : "none";
}

function changePvpBet(d) {
  const el = document.getElementById("pvpBet");
  el.value = Math.max(10, (Number(el.value) || 100) + d);
}
function setPvpBet(v) { document.getElementById("pvpBet").value = v; }

// ── Открываем экран PvP ──
function openPvpBj() {
  pvpPhase = "lobby";
  pvpRoomId = null;
  pvpMyUid = null;
  pvpShow("lobby");
  pvpLoadRooms();
}

// ── Список комнат ──
async function pvpLoadRooms() {
  const box = document.getElementById("pvpRoomsList");
  try {
    const res = await apiFetch("/api/pvp/bj/rooms", "GET");
    const rooms = res.rooms || [];
    if (rooms.length === 0) {
      box.innerHTML = '<div class="pvp-empty">Нет открытых комнат — создай свою!</div>';
    } else {
      box.innerHTML = rooms.map(r => `
        <div class="pvp-room-card">
          <div class="pvp-room-info">
            <div class="pvp-room-host">${escapeHtml(r.host)}</div>
            <div class="pvp-room-bet">💰 ${fmtNum(r.bet)} VBL</div>
          </div>
          <button class="pvp-room-join-btn" onclick="pvpBjJoin('${escapeHtml(r.room_id)}')">ВОЙТИ</button>
        </div>`).join("");
    }
  } catch(e) {
    box.innerHTML = '<div class="pvp-empty">Ошибка загрузки комнат</div>';
  }
}

// ── Создать комнату ──
async function pvpBjCreate() {
  const bet = Number(document.getElementById("pvpBet").value);
  if (!bet || bet < 10)   { showToast("Минимальная ставка: 10 VBL", "info"); return; }
  if (bet > balance)      { showToast("Недостаточно VBL-Coins!", "lose"); return; }
  try {
    const res = await apiFetch("/api/pvp/bj/create", "POST", { bet });
    pvpRoomId = res.room_id;
    pvpPhase = "waiting";
    updateBalanceUI(res.new_balance, null);
    document.getElementById("pvpWaitingBet").textContent = `Ставка: ${fmtNum(bet)} VBL`;
    document.getElementById("pvpWaitingRoomId").textContent = `ID: ${pvpRoomId}`;
    pvpShow("waiting");
    pvpStartPoll();
  } catch(e) {
    showToast(e.message, "lose");
  }
}

// ── Войти в комнату ──
async function pvpBjJoin(roomId) {
  try {
    const res = await apiFetch("/api/pvp/bj/join", "POST", { room_id: roomId });
    pvpRoomId = roomId;
    pvpPhase = "playing";
    updateBalanceUI(res.new_balance, null);
    pvpRenderGame(res);
    pvpShow("game");
    pvpStartPoll();
  } catch(e) {
    showToast(e.message, "lose");
    pvpLoadRooms();
  }
}

// ── Отменить ожидание (только хост, пока waiting) ──
async function pvpBjCancel() {
  if (!pvpRoomId) { pvpBackToLobby(); return; }
  try {
    const res = await apiFetch("/api/pvp/bj/leave", "POST", { room_id: pvpRoomId });
    updateBalanceUI(res.new_balance, null);
    showToast("Комната отменена, ставка возвращена", "info");
  } catch(e) {
    // игнорируем — всё равно уходим в лобби
  }
  pvpBackToLobby();
}

// ── Хит ──
async function pvpBjHit() {
  if (pvpLocked) return;
  pvpLocked = true;
  try {
    const res = await apiFetch("/api/pvp/bj/hit", "POST", { room_id: pvpRoomId });
    pvpRenderGame(res);
  } catch(e) {
    showToast(e.message, "lose");
  }
  pvpLocked = false;
}

// ── Стенд ──
async function pvpBjStand() {
  if (pvpLocked) return;
  pvpLocked = true;
  try {
    const res = await apiFetch("/api/pvp/bj/stand", "POST", { room_id: pvpRoomId });
    pvpRenderGame(res);
  } catch(e) {
    showToast(e.message, "lose");
  }
  pvpLocked = false;
}

// ── Полинг ──
function pvpStartPoll() {
  pvpStopPoll();
  pvpPollTimer = setInterval(pvpPollOnce, 1500);
}
function pvpStopPoll() {
  if (pvpPollTimer) { clearInterval(pvpPollTimer); pvpPollTimer = null; }
}

async function pvpPollOnce() {
  if (!pvpRoomId) return;
  try {
    const res = await apiFetch(`/api/pvp/bj/state?room_id=${encodeURIComponent(pvpRoomId)}`, "GET");

    if (pvpPhase === "waiting" && res.phase === "playing") {
      // соперник вошёл — переходим к игре
      pvpPhase = "playing";
      pvpRenderGame(res);
      pvpShow("game");
      return;
    }
    if (pvpPhase === "playing") {
      pvpRenderGame(res);
    }
  } catch(e) {
    // не прерываем игру из-за одного неудачного полла
  }
}

// ── Рендер игрового экрана ──
function pvpRenderGame(state) {
  const players = state.players || {};
  const uids    = Object.keys(players);

  // Определяем кто я: если pvpMyUid уже известен — берём его,
  // иначе ищем по принципу "кто не является единственным чужим"
  // Сервер шлёт данные обоих, мои карты всегда видны
  if (!pvpMyUid) {
    // мои карты — те у кого hand не ["?","?"]
    for (const uid of uids) {
      const hand = players[uid].hand || [];
      if (hand.length > 0 && !(hand[0][0] === "?" && hand[0][1] === "?")) {
        pvpMyUid = uid;
        break;
      }
    }
    if (!pvpMyUid && uids.length > 0) pvpMyUid = uids[0];
  }

  const oppUid = uids.find(u => u !== pvpMyUid) || null;
  const me     = pvpMyUid ? players[pvpMyUid] : null;
  const opp    = oppUid   ? players[oppUid]   : null;

  // Имена
  document.getElementById("pvpTagMe").textContent  = me  ? `@${me.username}`  : "Ты";
  document.getElementById("pvpTagOpp").textContent = opp ? `@${opp.username}` : "Соперник";

  // Мои карты
  const myCardsEl = document.getElementById("pvpMyCards");
  myCardsEl.innerHTML = "";
  if (me && me.hand) {
    me.hand.forEach(c => myCardsEl.appendChild(bjCardEl(c)));
  }

  // Карты соперника
  const oppCardsEl = document.getElementById("pvpOppCards");
  oppCardsEl.innerHTML = "";
  if (opp && opp.hand) {
    if (state.phase === "finished") {
      opp.hand.forEach(c => oppCardsEl.appendChild(bjCardEl(c)));
    } else {
      // рубашки — столько сколько карт у соперника
      for (let i = 0; i < opp.card_count; i++) {
        oppCardsEl.appendChild(bjCardEl(["?","?"]));
      }
    }
  }

  // Подписи сумм
  const myTotal  = me  && me.total  != null ? ` (${me.total})`  : "";
  const oppTotal = opp && opp.total != null && state.phase === "finished" ? ` (${opp.total})` : "";
  document.getElementById("pvpMyLabel").textContent  = `Мои карты${myTotal}`;
  document.getElementById("pvpOppLabel").textContent = `Соперник${oppTotal}`;

  // Статус-бейджи
  function renderStatus(el, status) {
    const labels = {
      playing:   "🎮 Ходит",
      stand:     "✋ Стенд",
      bust:      "💥 Перебор",
      blackjack: "⭐ Блэкджек",
      waiting:   "⏳ Ждёт",
    };
    el.textContent = labels[status] || "";
    el.className   = `pvp-status-badge ${status || ""}`;
  }
  renderStatus(document.getElementById("pvpMyStatus"),  me  ? me.status  : "waiting");
  renderStatus(document.getElementById("pvpOppStatus"), opp ? opp.status : "waiting");

  // Банк
  document.getElementById("pvpPotDisplay").textContent =
    `💰 Банк: ${fmtNum(state.bet * 2)} VBL (победитель получает 95%)`;

  // Кнопки
  const actionsEl = document.getElementById("pvpActions");
  const myDone    = me && ["stand","bust","blackjack"].includes(me.status);
  actionsEl.style.display = (!myDone && state.phase === "playing") ? "flex" : "none";

  // Результат
  const msgEl = document.getElementById("pvpResultMsg");
  if (state.phase === "finished") {
    pvpStopPoll();
    pvpPhase = "finished";
    const isWinner = state.winner === pvpMyUid;
    const isPush   = !state.winner;
    msgEl.textContent  = state.result_text || "Игра завершена";
    msgEl.className    = `slots-result-msg ${isWinner ? "win" : isPush ? "" : "lose"}`;
    fetchBalance(); // обновляем баланс после завершения
  } else if (state.phase === "playing") {
    if (myDone) {
      msgEl.textContent = "⏳ Ждём соперника…";
      msgEl.className   = "slots-result-msg";
    } else {
      msgEl.textContent = "";
    }
  }
}

// ── Вернуться в лобби PvP ──
function pvpBackToLobby() {
  pvpStopPoll();
  pvpRoomId  = null;
  pvpMyUid   = null;
  pvpPhase   = "lobby";
  pvpLocked  = false;
  document.getElementById("pvpResultMsg").textContent = "";
  pvpShow("lobby");
  pvpLoadRooms();
}

// ── Кнопка "← Назад" — если в ожидании — отменяем, иначе просто уходим ──
async function pvpBjLeaveAndGoLobby() {
  pvpStopPoll();
  if (pvpPhase === "waiting" && pvpRoomId) {
    try {
      const res = await apiFetch("/api/pvp/bj/leave", "POST", { room_id: pvpRoomId });
      updateBalanceUI(res.new_balance, null);
    } catch(e) {}
  }
  pvpRoomId = null;
  pvpMyUid  = null;
  pvpPhase  = null;
  goLobby();
}


// ══════════════════════════════════════════
//  CRASH — АВТО-ВЫВОД
// ══════════════════════════════════════════

// Автовывод: когда flying и множитель >= целевого — автоматически кешаутим
let crashAutoTriggered = false;

async function crashMaybeAutoCashout() {
  const enabled = document.getElementById("crashAutoEnabled");
  if (!enabled || !enabled.checked) return;
  if (!crashState || crashState.phase !== "flying") return;
  if (!crashMyBetThisRound || crashCashedOutThisRound) return;
  if (crashAutoTriggered) return;

  const target = parseFloat(document.getElementById("crashAutoMult").value);
  if (!target || target < 1.01) return;

  const live = crashLiveMultiplier();
  if (live >= target) {
    crashAutoTriggered = true;
    try {
      const res = await apiFetch("/api/play/crash/cashout", "POST", {});
      updateBalanceUI(res.new_balance, null);
      crashCashedOutThisRound = true;
      showToast(`🤖 Авто-вывод x${res.multiplier.toFixed(2)}! +${fmtNum(res.win)} VBL`, "win");
      crashPollOnce();
    } catch(e) {
      crashAutoTriggered = false; // попробуем ещё раз если не успел
    }
  }
}
