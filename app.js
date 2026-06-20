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
}

function goLobby() {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById("screen-lobby").classList.add("active");
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
//  DICE (3D Canvas)
// ══════════════════════════════════════════

let diceAnimFrame = null;
let diceAngle = { x: 20, y: 30 };
let diceTarget = { x: 20, y: 30 };
let diceSpinSpeed = { x: 0, y: 0 };
let diceFace = 1;
let diceSettled = true;

const DICE_DOTS = {
  1: [[0.5,0.5]],
  2: [[0.25,0.25],[0.75,0.75]],
  3: [[0.25,0.25],[0.5,0.5],[0.75,0.75]],
  4: [[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]],
  5: [[0.25,0.25],[0.75,0.25],[0.5,0.5],[0.25,0.75],[0.75,0.75]],
  6: [[0.25,0.2],[0.75,0.2],[0.25,0.5],[0.75,0.5],[0.25,0.8],[0.75,0.8]],
};

function initDice() {
  diceChosen = null;
  diceFace = 1;
  diceSettled = true;
  document.querySelectorAll(".dice-num-btn").forEach(b => b.classList.remove("selected"));
  document.getElementById("diceResultMsg").textContent = "";
  document.getElementById("diceResultMsg").className = "slots-result-msg";
  document.getElementById("diceResultDisplay").textContent = "?";
  drawDice3D(1);
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

  diceSettled = false;
  diceSpinSpeed = { x: 8 + Math.random() * 6, y: 12 + Math.random() * 8 };
  animateDiceSpin();

  let result;
  try {
    result = await apiFetch("/api/play/dice", "POST", { bet, chosen: diceChosen });
  } catch(e) {
    showToast(e.message, "lose");
    stopDiceAnim();
    isSpinning = false; btn.disabled = false;
    return;
  }

  await delay(800);
  slowDownDice(result.result, () => {
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
  });
}

function animateDiceSpin() {
  if (diceAnimFrame) cancelAnimationFrame(diceAnimFrame);
  function frame() {
    if (diceSettled) return;
    diceAngle.x += diceSpinSpeed.x;
    diceAngle.y += diceSpinSpeed.y;
    drawDice3D(diceFace, diceAngle.x, diceAngle.y);
    diceAnimFrame = requestAnimationFrame(frame);
  }
  frame();
}

function slowDownDice(targetFace, callback) {
  let frames = 0;
  const totalFrames = 40;
  const startSpeedX = diceSpinSpeed.x;
  const startSpeedY = diceSpinSpeed.y;

  function decel() {
    frames++;
    const t = frames / totalFrames;
    diceSpinSpeed.x = startSpeedX * (1 - t);
    diceSpinSpeed.y = startSpeedY * (1 - t);
    diceAngle.x += diceSpinSpeed.x;
    diceAngle.y += diceSpinSpeed.y;
    drawDice3D(targetFace, diceAngle.x, diceAngle.y);
    if (frames < totalFrames) {
      diceAnimFrame = requestAnimationFrame(decel);
    } else {
      diceSettled = true;
      diceFace = targetFace;
      diceAngle = { x: 20, y: 30 };
      drawDice3D(targetFace, 20, 30);
      if (callback) callback();
    }
  }
  if (diceAnimFrame) cancelAnimationFrame(diceAnimFrame);
  decel();
}

function stopDiceAnim() {
  diceSettled = true;
  if (diceAnimFrame) cancelAnimationFrame(diceAnimFrame);
}

function drawDice3D(face, rotX = 20, rotY = 30) {
  const canvas = document.getElementById("diceCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const size = 64;
  const rx = (rotX * Math.PI) / 180;
  const ry = (rotY * Math.PI) / 180;

  function project([x, y, z]) {
    const x1 = x * Math.cos(ry) + z * Math.sin(ry);
    const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
    const y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
    const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
    const fov = 5;
    const scale = fov / (fov + z2 * 0.8);
    return [cx + x1 * size * scale, cy + y2 * size * scale, z2];
  }

  const v = [
    [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
    [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],
  ].map(project);

  const faces = [
    { verts:[0,1,2,3], normal:[0,0,-1], face:1 },
    { verts:[4,5,6,7], normal:[0,0,1],  face:6 },
    { verts:[0,1,5,4], normal:[0,-1,0], face:2 },
    { verts:[2,3,7,6], normal:[0,1,0],  face:5 },
    { verts:[0,3,7,4], normal:[-1,0,0], face:3 },
    { verts:[1,2,6,5], normal:[1,0,0],  face:4 },
  ];

  faces.forEach(f => { f.avgZ = f.verts.reduce((s,i) => s + v[i][2], 0) / 4; });
  faces.sort((a, b) => a.avgZ - b.avgZ);

  for (const f of faces) {
    const pts = f.verts.map(i => v[i]);
    const lightDir = [0.5, -0.8, 0.3];
    const n = f.normal;
    const dot = Math.max(0, n[0]*lightDir[0] + n[1]*lightDir[1] + n[2]*lightDir[2]);
    const brightness = 0.35 + dot * 0.65;

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();

    const r = Math.round(30 * brightness), g = Math.round(30 * brightness), b = Math.round(60 * brightness + 10);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(155, 89, 255, ${0.4 * brightness})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawDiceDots(ctx, pts, f.face === face ? face : f.face, brightness);
  }
}

function drawDiceDots(ctx, pts, face, brightness) {
  const dots = DICE_DOTS[face] || [];
  if (!dots.length) return;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function bilinear(u, v) {
    const top    = [lerp(pts[0][0], pts[1][0], u), lerp(pts[0][1], pts[1][1], u)];
    const bottom = [lerp(pts[3][0], pts[2][0], u), lerp(pts[3][1], pts[2][1], u)];
    return [lerp(top[0], bottom[0], v), lerp(top[1], bottom[1], v)];
  }

  const alpha = Math.min(1, brightness * 1.6);
  dots.forEach(([u, v]) => {
    const [dx, dy] = bilinear(u, v);
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240, 192, 64, ${alpha})`;
    ctx.shadowColor = "rgba(240, 192, 64, 0.8)";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  });
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
