/* =====================================================================
   সিলেট BRTC বাস সিমুলেটর  (Sylhet BRTC Bus Simulator)
   Vanilla HTML5 Canvas game. Side-scrolling double-decker bus driving
   through recognisable Sylhet streets: SUST -> Tilagor -> Mount Adora
   Hospital -> Shwapno -> Zindabazar -> Ambarkhana -> Bondor Bazar ->
   Madina Market. Pick up students (fare ৳5). Avoid rickshaws & CNGs.
   ===================================================================== */
'use strict';

/* ----------------------------- helpers ----------------------------- */
const rand   = (a, b) => a + Math.random() * (b - a);
const randInt= (a, b) => Math.floor(rand(a, b + 1));
const pick   = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp  = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp   = (a, b, t) => a + (b - a) * t;

/* ----------------------------- canvas ------------------------------- */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;
const L = {}; // layout, recomputed on resize

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth  || window.innerWidth;
  H = canvas.clientHeight || window.innerHeight;
  canvas.width  = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  computeLayout();
}
function computeLayout() {
  L.skyY        = H * 0.46;
  L.buildingBase = H * 0.64;   // where buildings sit
  L.curbY       = H * 0.715;   // sidewalk / road boundary
  L.roadY       = H * 0.715;
  L.groundY     = H * 0.90;    // wheel contact line
  L.busW        = clamp(H * 0.36, 210, 460);
  L.busH        = L.busW * 0.60;
  L.busScreenX  = W * 0.30;
}
window.addEventListener('resize', resize);

/* --------------------------- route / zones -------------------------- */
const SEG = 2600; // world px between zone centres
const ZONES = [
  { id:'sust',       bn:'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', en:'SUST',              landmark:'sust',        palette:['#3f7d4f','#4f8f5e','#e9eef2','#cfe0d2'] },
  { id:'tilagor',    bn:'টিলাগড়',                               en:'Tilagor',           landmark:'tilagor',     palette:['#2f6b3f','#3c7a4c','#cf6','#bfe3c4'] },
  { id:'mountadora', bn:'মাউন্ট আদরা হাসপাতাল',                  en:'Mount Adora Hospital', landmark:'hospital',  palette:['#ffffff','#e8f0fb','#dfeaf7','#cfe0f2'] },
  { id:'shwapno',    bn:'শ্বপ্ন সুপার শপ',                       en:'Shwapno',            landmark:'shwapno',      palette:['#d11f2a','#f2f2f2','#ffd23f','#e23b41'] },
  { id:'zindabazar', bn:'জিন্দাবাজার',                           en:'Zindabazar',         landmark:'market',       palette:['#c8443b','#e0a32e','#3f7d9b','#7a5ba6'] },
  { id:'ambarkhana', bn:'আম্বরখানা',                             en:'Ambarkhana',         landmark:'intersection', palette:['#8a8f99','#b6bcc6','#c9a14a','#d98b3a'] },
  { id:'bondor',     bn:'বন্দর বাজার',                           en:'Bondor Bazar',       landmark:'market',       palette:['#9c6b3f','#c08a4e','#b5462f','#d9b38a'] },
  { id:'madina',     bn:'মদিনা মার্কেট',                         en:'Madina Market',      landmark:'madina',       palette:['#1f7a4d','#2fa566','#e8c34a','#d9d2c4'] },
];
ZONES.forEach((z, i) => { z.x = 1400 + i * SEG; z.index = i; });
const WORLD_END = ZONES[ZONES.length - 1].x + 1500;

/* --------------------------- game state ----------------------------- */
let worldBuilt = false;
let state = 'menu';            // menu | playing | paused | won
const game = {
  bus: { worldX: 120, speed: 0, maxSpeed: 540, accel: 300, brake: 560, wheel: 0, door: 0, bounce: 0, boarding: 0 },
  money: 0, passengers: 0, boarded: 0, stopsDone: 0,
  cameraX: 0, time: 0, crash: 0, shake: 0,
  traffic: [], clouds: [], poles: [], trees: [], birds: [], popups: [],
};
const FARE = 5;
const SPEED_TO_KMH = 0.20;     // px/s -> km/h-ish display

/* input */
const keys = {};
const press = { gas:false, brake:false, door:false }; // for touch
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (['arrowright','arrowleft','arrowup','arrowdown',' '].includes(k)) e.preventDefault();
  if (k === ' ') tryToggleDoor();
  if (k === 'h' || k === 'arrowup') honk();
  if (k === 'p') togglePause();
  if (k === 'r') restartGame();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

/* --------------------------- audio (lazy) --------------------------- */
let actx = null;
function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } return actx; }
function honk() {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'sawtooth'; o.frequency.value = 320;
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.18, a.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.35);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.36);
}
function chime() {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'triangle'; o.frequency.value = 880;
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.14, a.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.18);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.2);
}
function thud() {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'square'; o.frequency.value = 90;
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.22, a.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.22);
  o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.24);
}

/* --------------------------- build world ---------------------------- */
function buildWorld() {
  worldBuilt = true;
  // per-zone building strips (fractions of H so they scale)
  ZONES.forEach(z => {
    z.buildings = [];
    let x = -SEG/2 + rand(20,80);
    while (x < SEG/2 - 80) {
      const w = rand(0.05, 0.13) * H;
      const h = rand(0.12, 0.34) * H;
      z.buildings.push({ off: x, w, h, c: pick(z.palette), lit: Math.random() < 0.5 });
      x += w + rand(0.01, 0.05) * H;
    }
    // waiting students for the stop
    const n = z.index === 0 ? randInt(4,6) : randInt(3,7);
    z.stop = { waiting: n, done: false, boardTimer: 0, closeTimer: 0, students: [] };
    for (let i = 0; i < n; i++) z.stop.students.push({ dx: (i - n/2) * 26 + rand(-8,8), wave: Math.random()*6.28, boarded: false });
  });
  // clouds, poles, trees, birds across the whole world
  game.clouds = [];
  for (let i = 0; i < 22; i++) game.clouds.push({ x: rand(0, WORLD_END), y: rand(0.05, 0.32) * H, s: rand(0.6, 1.5), sp: rand(4, 14) });
  game.poles = [];
  for (let x = 300; x < WORLD_END; x += rand(420, 620)) game.poles.push({ x, h: rand(0.18,0.24)*H });
  game.trees = [];
  for (let x = 700; x < WORLD_END; x += rand(500, 900)) game.trees.push({ x, s: rand(0.8,1.4) });
  game.birds = [];
  for (let i = 0; i < 10; i++) game.birds.push({ x: rand(0, WORLD_END), y: rand(0.08,0.3)*H, ph: rand(0,6.28), sp: rand(20,40) });
}

/* --------------------------- reset run ------------------------------ */
function resetRun() {
  game.bus.worldX = 120; game.bus.speed = 0; game.bus.wheel = 0; game.bus.door = 0; game.bus.bounce = 0; game.bus.boarding = 0;
  game.money = 0; game.passengers = 0; game.boarded = 0; game.stopsDone = 0;
  game.cameraX = 0; game.time = 0; game.crash = 0; game.shake = 0;
  game.traffic = []; game.popups = [];
  buildWorld();
}

/* --------------------------- door logic ----------------------------- */
function nearStop() {
  for (const z of ZONES) {
    if (z.stop.done) continue;
    if (Math.abs(game.bus.worldX - z.x) < 240) return z;
  }
  return null;
}
function tryToggleDoor() {
  if (state !== 'playing') return;
  const z = nearStop();
  if (!z) return;
  if (game.bus.speed > 45) { flash('গাড়ি থামান!', '#ffd23f'); return; }
  if (game.bus.door < 0.5) { game.bus.door = 1; flash('দরজা খোলা — ছাত্রছাত্রী উঠছে', '#7CFC9B'); }
  else { game.bus.door = 0; }
}

function flash(text, color) { game.popups.push({ text, color, x: W/2, y: H*0.30, life: 1.6, big: true }); }
function addPopup(text, color, x, y) { game.popups.push({ text, color, x, y, life: 1.3, big: false }); }

/* --------------------------- update --------------------------------- */
let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, 0.05);
  if (state === 'playing') update(dt);
  else { game.time += dt; game.bus.wheel += dt * 0.5; } // idle anim on menu
  render();
  requestAnimationFrame(loop);
}

function update(dt) {
  game.time += dt;
  const b = game.bus;

  // controls
  const gas   = keys['arrowright'] || keys['d'] || press.gas;
  const brake = keys['arrowleft']  || keys['a'] || press.brake;

  if (gas)        b.speed += b.accel * dt;
  else if (brake) b.speed -= b.brake * dt;
  else            b.speed -= 120 * dt;                 // rolling friction
  if (b.speed < -120) b.speed = -120;
  if (b.speed > b.maxSpeed) b.speed = b.maxSpeed;

  // door auto-close if moving
  if (b.door > 0 && b.speed > 60) b.door = Math.max(0, b.door - dt * 3);

  // boarding
  const z = nearStop();
  if (z && b.door > 0.5 && b.speed < 45 && z.stop.waiting > 0) {
    z.stop.boardTimer -= dt;
    if (z.stop.boardTimer <= 0) {
      z.stop.boardTimer = 0.42;
      z.stop.waiting--;
      game.passengers++; game.boarded++; game.money += FARE;
      const s = z.stop.students.find(s => !s.boarded); if (s) s.boarded = true;
      addPopup('+৳' + FARE, '#ffe14d', W*0.30 + L.busW*0.42, H*0.55);
      chime();
      if (z.stop.waiting === 0) { z.stop.done = true; game.stopsDone++; z.stop.closeTimer = 1.0; flash('স্টপ শেষ — আবার যাত্রা!', '#7CFC9B'); }
    }
  }
  if (z && z.stop.done && z.stop.closeTimer > 0) { z.stop.closeTimer -= dt; if (z.stop.closeTimer <= 0) b.door = 0; }

  // advance bus
  b.worldX += b.speed * dt;
  if (b.worldX < 0) b.worldX = 0;
  b.wheel += (b.speed / L.busW) * dt * 8;
  b.bounce = Math.sin(game.time * 14) * Math.min(2, Math.abs(b.speed) * 0.004);

  // camera
  game.cameraX = b.worldX - L.busScreenX;

  // traffic spawn
  if (game.traffic.length < 6 && Math.random() < dt * 0.6) {
    const type = Math.random() < 0.5 ? 'rickshaw' : 'cng';
    game.traffic.push({ x: game.cameraX + W + rand(120, 400), type, speed: rand(70, 150), y: rand(-6, 10), wheel: 0 });
  }
  // traffic update + collision (bus queues behind slower traffic)
  for (const t of game.traffic) {
    t.x += t.speed * dt; t.wheel += (t.speed / 60) * dt * 10;
    if (Math.abs(b.worldX - t.x) < L.busW*0.5 + 40 && b.speed > t.speed + 15 && b.speed > 60) {
      b.speed = t.speed; game.crash = 0.4; game.shake = 6; if (Math.random() < dt*4) thud();
    }
  }
  game.traffic = game.traffic.filter(t => t.x > game.cameraX - 360);

  // clouds / birds drift
  for (const c of game.clouds) { c.x += c.sp * dt; if (c.x > WORLD_END + 200) c.x = -200; }
  for (const bd of game.birds) { bd.x += bd.sp * dt; bd.ph += dt*4; if (bd.x > WORLD_END) bd.x = -50; }

  if (game.crash > 0) game.crash -= dt;
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 20);

  // popups
  for (const p of game.popups) { p.life -= dt; p.y -= dt * 28; }
  game.popups = game.popups.filter(p => p.life > 0);

  // win
  if (b.worldX >= WORLD_END) winGame();
}

/* --------------------------- render --------------------------------- */
function render() {
  ctx.save();
  if (game.shake > 0) ctx.translate(rand(-game.shake, game.shake), rand(-game.shake, game.shake));

  drawSky();
  drawHills();
  drawClouds();
  drawBirds();

  // cityscape per visible zone
  const camX = game.cameraX;
  const firstZone = Math.max(0, Math.floor((camX) / SEG) - 1);
  const lastZone  = Math.min(ZONES.length - 1, Math.ceil((camX + W) / SEG) + 1);
  for (let i = firstZone; i <= lastZone; i++) drawZone(ZONES[i]);

  drawTrees();
  drawPoles();
  drawSidewalk();
  drawStudents();      // waiting at stops (behind bus)
  drawRoad();
  drawTraffic();
  drawBus();
  drawPopups();

  ctx.restore();
  drawHUD();
}

function sx(wx) { return wx - game.cameraX; }

/* sky + sun */
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, L.skyY + 40);
  g.addColorStop(0, '#7ec8f0'); g.addColorStop(0.6, '#bfe6f7'); g.addColorStop(1, '#eaf6fb');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sun
  ctx.save();
  const sx2 = W * 0.80, sy2 = H * 0.16;
  const sg = ctx.createRadialGradient(sx2, sy2, 8, sx2, sy2, 90);
  sg.addColorStop(0, 'rgba(255,247,200,.95)'); sg.addColorStop(1, 'rgba(255,247,200,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx2, sy2, 90, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff4c2'; ctx.beginPath(); ctx.arc(sx2, sy2, 34, 0, 7); ctx.fill();
  ctx.restore();
}
function drawHills() {
  ctx.fillStyle = '#bfe0b0';
  ctx.beginPath(); ctx.moveTo(0, L.skyY);
  for (let x = 0; x <= W; x += 80) ctx.lineTo(x, L.skyY - 18 - 22 * Math.sin(x * 0.004 + 1));
  ctx.lineTo(W, L.buildingBase); ctx.lineTo(0, L.buildingBase); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a9d49a';
  ctx.beginPath(); ctx.moveTo(0, L.skyY + 14);
  for (let x = 0; x <= W; x += 70) ctx.lineTo(x, L.skyY + 14 - 16 * Math.sin(x * 0.006 + 3));
  ctx.lineTo(W, L.buildingBase); ctx.lineTo(0, L.buildingBase); ctx.closePath(); ctx.fill();
}
function drawClouds() {
  for (const c of game.clouds) {
    const x = sx(c.x), y = c.y;
    if (x < -160 || x > W + 160) continue;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    const s = c.s;
    ctx.beginPath();
    ctx.ellipse(x, y, 46*s, 22*s, 0, 0, 7);
    ctx.ellipse(x + 40*s, y + 6*s, 34*s, 18*s, 0, 0, 7);
    ctx.ellipse(x - 38*s, y + 8*s, 30*s, 16*s, 0, 0, 7);
    ctx.fill();
  }
}
function drawBirds() {
  ctx.strokeStyle = 'rgba(40,50,60,.55)'; ctx.lineWidth = 2;
  for (const b of game.birds) {
    const x = sx(b.x), y = b.y + Math.sin(b.ph) * 6;
    if (x < -30 || x > W + 30) continue;
    const f = Math.sin(b.ph * 2) * 5;
    ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.quadraticCurveTo(x, y - f, x, y);
    ctx.quadraticCurveTo(x, y - f, x + 8, y); ctx.stroke();
  }
}

/* a single zone's buildings + landmark + signboard */
function drawZone(z) {
  const baseX = sx(z.x);
  if (baseX < -SEG || baseX > W + SEG) return;

  // buildings
  for (const b of z.buildings) {
    const x = sx(z.x + b.off);
    const w = b.w, h = b.h, top = L.buildingBase - h;
    ctx.fillStyle = b.c; ctx.fillRect(x, top, w, h);
    // roof trim
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x, top, w, 4);
    // windows
    ctx.fillStyle = b.lit ? 'rgba(255,236,150,.9)' : 'rgba(20,30,45,.35)';
    const cols = Math.max(2, Math.floor(w / 22)), rows = Math.max(2, Math.floor(h / 26));
    const mw = (w - (cols+1)*4) / cols, mh = (h - (rows+1)*6) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      ctx.fillRect(x + 4 + c*(mw+4), top + 6 + r*(mh+6), mw, mh);
  }

  // landmark feature at centre
  const lx = baseX, by = L.buildingBase;
  switch (z.landmark) {
    case 'sust':        drawSUST(lx, by); break;
    case 'tilagor':     drawTilagor(lx, by); break;
    case 'hospital':    drawHospital(lx, by); break;
    case 'shwapno':     drawShwapno(lx, by); break;
    case 'market':      drawMarket(lx, by, z.en); break;
    case 'intersection':drawIntersection(lx, by); break;
    case 'madina':      drawMadina(lx, by); break;
  }

  // big signboard with location name
  drawSign(lx, z.bn, z.en, z.palette[0]);
}

/* ----- landmark drawings ----- */
function drawSign(cx, bn, en, color) {
  const y = L.buildingBase - 96;
  const w = Math.min(300, W * 0.42), h = 54;
  // pole
  ctx.fillStyle = '#5a5f68'; ctx.fillRect(cx - 4, y, 8, 96);
  // board
  ctx.fillStyle = color; roundRect(cx - w/2, y - h, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; roundRect(cx - w/2, y - h, w, h, 10); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.min(26, h*0.5)}px "Hind Siliguri","Noto Sans Bengali",sans-serif`;
  ctx.fillText(bn, cx, y - h*0.66);
  ctx.font = `600 ${Math.min(14, h*0.28)}px "Hind Siliguri",sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.fillText(en.toUpperCase(), cx, y - h*0.24);
}
function drawSUST(cx, by) {
  // green campus gate arch
  ctx.fillStyle = '#2f6b3f';
  ctx.fillRect(cx - 130, by - 150, 18, 150);
  ctx.fillRect(cx + 112, by - 150, 18, 150);
  ctx.fillRect(cx - 130, by - 150, 260, 26);
  ctx.fillStyle = '#1f4d2c'; ctx.fillRect(cx - 150, by - 124, 300, 16);
  ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = `800 ${Math.min(40, W*0.05)}px "Hind Siliguri",sans-serif`;
  ctx.fillText('SUST', cx, by - 132);
  ctx.font = `600 13px "Hind Siliguri",sans-serif`;
  ctx.fillText('শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', cx, by - 100);
  // little dome
  ctx.fillStyle = '#cfd8dc'; ctx.beginPath(); ctx.arc(cx, by - 150, 10, Math.PI, 0); ctx.fill();
}
function drawTilagor(cx, by) {
  // eco-park green hill + trees
  ctx.fillStyle = '#2f6b3f';
  ctx.beginPath(); ctx.moveTo(cx-150, by); ctx.quadraticCurveTo(cx, by-130, cx+150, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3c7a4c';
  ctx.beginPath(); ctx.moveTo(cx-90, by); ctx.quadraticCurveTo(cx+10, by-90, cx+120, by); ctx.closePath(); ctx.fill();
  drawTreeShape(cx - 40, by, 1.1, '#1f5a30');
  drawTreeShape(cx + 60, by, 1.3, '#1f5a30');
  ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = `700 16px "Hind Siliguri",sans-serif`; ctx.fillText('ইকো পার্ক · Eco Park', cx, by - 110);
}
function drawHospital(cx, by) {
  // white building, red cross, Mount Adora sign
  ctx.fillStyle = '#f3f8ff'; ctx.fillRect(cx - 110, by - 170, 220, 170);
  ctx.fillStyle = '#dbe7f5'; ctx.fillRect(cx - 110, by - 170, 220, 14);
  // windows
  ctx.fillStyle = '#9fc0e0';
  for (let r=0;r<3;r++) for (let c=0;c<5;c++) ctx.fillRect(cx-95+c*42, by-150+r*44, 28, 26);
  // red cross
  ctx.fillStyle = '#d11f2a';
  ctx.fillRect(cx - 12, by - 158, 24, 60); ctx.fillRect(cx - 30, by - 140, 60, 24);
  ctx.fillStyle = '#d11f2a'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = `800 20px "Hind Siliguri",sans-serif`; ctx.fillText('MOUNT ADORA', cx, by - 190);
  ctx.fillStyle = '#1f7a4d'; ctx.font = `700 14px "Hind Siliguri",sans-serif`; ctx.fillText('HOSPITAL · হাসপাতাল', cx, by - 6);
}
function drawShwapno(cx, by) {
  // grocery storefront with red awning
  ctx.fillStyle = '#e23b41'; ctx.fillRect(cx - 120, by - 120, 240, 120);
  ctx.fillStyle = '#fff'; ctx.fillRect(cx - 120, by - 120, 240, 60);
  // awning stripes
  for (let i=0;i<8;i++){ ctx.fillStyle = i%2? '#d11f2a':'#fff'; ctx.fillRect(cx-120+i*30, by-150, 30, 30); }
  ctx.fillStyle = '#d11f2a'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = `800 30px "Hind Siliguri",sans-serif`; ctx.fillText('Shwapno', cx, by - 90);
  ctx.fillStyle = '#7a1010'; ctx.font = `700 14px "Hind Siliguri",sans-serif`; ctx.fillText('শ্বপ্ন সুপার শপ', cx, by - 62);
  // shopping cart hint
  ctx.fillStyle = '#333'; ctx.fillRect(cx-100, by-40, 26, 18);
}
function drawMarket(cx, by, name) {
  // colourful market stalls
  const cols = ['#c8443b','#e0a32e','#3f7d9b','#7a5ba6','#2fa566'];
  for (let i=0;i<4;i++){
    const bx = cx - 150 + i*78;
    ctx.fillStyle = cols[i%cols.length]; ctx.fillRect(bx, by - 90, 66, 90);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(bx, by - 110, 66, 24);
    ctx.fillStyle = '#222'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font = `700 11px "Hind Siliguri",sans-serif`; ctx.fillText('দোকান', bx+33, by - 98);
  }
  ctx.fillStyle = '#222'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = `800 18px "Hind Siliguri",sans-serif`; ctx.fillText(name, cx, by - 128);
}
function drawIntersection(cx, by) {
  // busy junction: traffic signal + shops
  ctx.fillStyle = '#8a8f99'; ctx.fillRect(cx - 120, by - 140, 240, 140);
  ctx.fillStyle = '#b6bcc6'; ctx.fillRect(cx - 120, by - 140, 240, 16);
  for (let r=0;r<2;r++) for (let c=0;c<6;c++){ ctx.fillStyle='#5b6470'; ctx.fillRect(cx-110+c*38, by-120+r*46, 26, 34); }
  // traffic light pole
  ctx.fillStyle = '#444'; ctx.fillRect(cx + 130, by - 200, 8, 200);
  ctx.fillStyle = '#222'; ctx.fillRect(cx + 116, by - 230, 36, 60);
  ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(cx+134, by-214, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(cx+134, by-196, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#39d353'; ctx.beginPath(); ctx.arc(cx+134, by-178, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = `800 16px "Hind Siliguri",sans-serif`; ctx.fillText('আম্বরখানা মোড়', cx, by - 160);
}
function drawMadina(cx, by) {
  // green arch market gate
  ctx.fillStyle = '#1f7a4d';
  ctx.fillRect(cx-140, by-160, 16, 160); ctx.fillRect(cx+124, by-160, 16, 160);
  ctx.beginPath(); ctx.arc(cx, by-160, 140, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#2fa566'; ctx.fillRect(cx-156, by-160, 312, 18);
  ctx.fillStyle = '#ffe14d'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = `800 26px "Hind Siliguri",sans-serif`; ctx.fillText('MADINA MARKET', cx, by - 150);
  ctx.fillStyle = '#fff'; ctx.font = `700 16px "Hind Siliguri",sans-serif`; ctx.fillText('মদিনা মার্কেট · Tuker Bazar', cx, by - 120);
}
function drawTreeShape(x, baseY, s, color) {
  ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 5*s, baseY - 40*s, 10*s, 40*s);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, baseY - 52*s, 28*s, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 20*s, baseY - 40*s, 20*s, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 20*s, baseY - 40*s, 20*s, 0, 7); ctx.fill();
}

function drawTrees() {
  for (const t of game.trees) {
    const x = sx(t.x); if (x < -60 || x > W + 60) continue;
    if (Math.sin(t.x) > 0.4) continue; // thin them out deterministically
    drawTreeShape(x, L.buildingBase, t.s, '#2f6b3f');
  }
}
function drawPoles() {
  for (const p of game.poles) {
    const x = sx(p.x); if (x < -30 || x > W + 30) continue;
    ctx.fillStyle = '#6b6f76'; ctx.fillRect(x - 3, L.buildingBase - p.h, 6, p.h + 20);
    ctx.strokeStyle = '#3a3d42'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, L.buildingBase - p.h); ctx.lineTo(x, L.curbY); ctx.stroke();
    // wires
    ctx.strokeStyle = 'rgba(30,30,30,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, L.buildingBase - p.h); ctx.lineTo(x + 360, L.buildingBase - p.h + 14); ctx.stroke();
  }
}

/* sidewalk strip */
function drawSidewalk() {
  ctx.fillStyle = '#cfc7ba'; ctx.fillRect(0, L.buildingBase, W, L.curbY - L.buildingBase + 4);
  ctx.fillStyle = '#b8af9f'; ctx.fillRect(0, L.curbY - 4, W, 8); // curb edge
  // tiles
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
  for (let x = -(game.cameraX % 60); x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, L.buildingBase); ctx.lineTo(x, L.curbY); ctx.stroke(); }
}

/* waiting students at each stop */
function drawStudents() {
  for (const z of ZONES) {
    const s = sx(z.x);
    if (s < -200 || s > W + 200) continue;
    for (const st of z.stop.students) {
      if (st.boarded) continue;
      const px = s + st.dx, py = L.curbY - 2;
      drawPerson(px, py, 0.9, st.wave + game.time * 3);
    }
  }
}
function drawPerson(x, baseY, sc, wave) {
  const h = 34 * sc;
  ctx.save(); ctx.translate(x, baseY);
  // body
  ctx.fillStyle = pick(['#3a7bd5','#e0573e','#2fa566','#f0b429','#8e44ad','#16a085']);
  ctx.fillRect(-6*sc, -h*0.55, 12*sc, h*0.55);
  // head
  ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(0, -h*0.7, 6*sc, 0, 7); ctx.fill();
  // waving arm
  ctx.strokeStyle = '#f1c27d'; ctx.lineWidth = 3*sc;
  ctx.beginPath(); ctx.moveTo(5*sc, -h*0.5);
  ctx.lineTo(5*sc + Math.cos(wave)*8*sc, -h*0.5 - Math.abs(Math.sin(wave))*12*sc); ctx.stroke();
  ctx.restore();
}

/* road */
function drawRoad() {
  const g = ctx.createLinearGradient(0, L.roadY, 0, H);
  g.addColorStop(0, '#5a5f66'); g.addColorStop(1, '#41464c');
  ctx.fillStyle = g; ctx.fillRect(0, L.roadY, W, H - L.roadY);
  // far edge line
  ctx.fillStyle = '#d9dde2'; ctx.fillRect(0, L.roadY, W, 3);
  // centre dashed lane (BRTC drives on left side, dashed divider)
  ctx.strokeStyle = '#f4d03f'; ctx.lineWidth = 5; ctx.setLineDash([34, 28]);
  ctx.beginPath(); ctx.moveTo(0, L.roadY + (H - L.roadY) * 0.42);
  ctx.lineTo(W, L.roadY + (H - L.roadY) * 0.42); ctx.stroke();
  ctx.setLineDash([]);
  // potholes / cracks
  ctx.fillStyle = 'rgba(20,20,20,.35)';
  for (let x = -(game.cameraX % 240); x < W; x += 240) {
    const r = 7 + (Math.sin(x) * 0.5 + 0.5) * 8;
    ctx.beginPath(); ctx.ellipse(x + 60, L.groundY - 6, r, r*0.5, 0, 0, 7); ctx.fill();
  }
}

/* traffic (rickshaw / cng) */
function drawTraffic() {
  for (const t of game.traffic) {
    const x = sx(t.x); if (x < -160 || x > W + 160) continue;
    if (t.type === 'rickshaw') drawRickshaw(x, L.groundY + t.y, t.wheel);
    else drawCNG(x, L.groundY + t.y, t.wheel);
  }
}
function drawRickshaw(x, y, wheel) {
  const s = 0.8;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#2b2b2b';
  // wheels
  drawWheel(-26*s, 0, 13*s, wheel); drawWheel(34*s, 0, 13*s, wheel);
  // body / hood
  ctx.fillStyle = '#e23b41'; roundRect(-40*s, -46*s, 56*s, 30*s, 8*s); ctx.fill();
  ctx.fillStyle = '#ffd23f'; roundRect(-40*s, -46*s, 56*s, 8*s, 4*s); ctx.fill();
  // seat back
  ctx.fillStyle = '#b51f27'; ctx.fillRect(8*s, -48*s, 8*s, 26*s);
  // handle
  ctx.strokeStyle = '#333'; ctx.lineWidth = 4*s;
  ctx.beginPath(); ctx.moveTo(-40*s, -16*s); ctx.lineTo(-58*s, -40*s); ctx.stroke();
  // driver
  ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(-50*s, -44*s, 6*s, 0, 7); ctx.fill();
  ctx.fillStyle = '#1f7a4d'; ctx.fillRect(-56*s, -42*s, 14*s, 22*s);
  // passenger
  ctx.fillStyle = '#3a7bd5'; ctx.fillRect(-6*s, -40*s, 14*s, 26*s);
  ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(1*s, -46*s, 6*s, 0, 7); ctx.fill();
  ctx.restore();
}
function drawCNG(x, y, wheel) {
  const s = 0.85;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#2b2b2b';
  drawWheel(-30*s, 0, 13*s, wheel); drawWheel(30*s, 0, 13*s, wheel); drawWheel(0, 0, 12*s, wheel);
  // green auto body
  ctx.fillStyle = '#1f9d55';
  roundRect(-40*s, -52*s, 80*s, 40*s, 10*s); ctx.fill();
  // roof
  ctx.fillStyle = '#16a085'; roundRect(-38*s, -64*s, 76*s, 16*s, 8*s); ctx.fill();
  // windshield
  ctx.fillStyle = '#cfeefb'; roundRect(20*s, -50*s, 18*s, 22*s, 4*s); ctx.fill();
  // window
  ctx.fillStyle = '#bfe6f5'; roundRect(-34*s, -48*s, 26*s, 20*s, 4*s); ctx.fill();
  // CNG sign
  ctx.fillStyle = '#fff'; ctx.font = `800 ${11*s}px "Hind Siliguri",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('CNG', 0, -44*s);
  // driver
  ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(-22*s, -40*s, 6*s, 0, 7); ctx.fill();
  ctx.restore();
}
function drawWheel(x, y, r, wheel) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(0, 0, r*0.45, 0, 7); ctx.fill();
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; ctx.rotate(wheel);
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(r*0.8, 0); ctx.rotate(Math.PI/2); }
  ctx.restore();
}

/* the BRTC double-decker bus */
function drawBus() {
  const b = game.bus;
  const x = W*0.30;                 // fixed screen x
  const y = L.groundY + b.bounce;
  drawBusBody(x, y, L.busW, L.busH, b.wheel, b.door, game.passengers);
}
function drawBusBody(cx, baseY, w, h, wheel, door, passengers) {
  const bw = w, bh = h;
  const left = cx - bw/2, right = cx + bw/2;
  const wheelR = bw * 0.075;
  const bodyBottom = baseY - wheelR * 0.6;
  const bodyTop = bodyBottom - bh;
  const deckSplit = bodyTop + bh * 0.42;   // lower deck / upper deck boundary

  ctx.save();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(cx, baseY + 4, bw*0.52, wheelR*0.7, 0, 0, 7); ctx.fill();

  // lower deck (BRTC red)
  ctx.fillStyle = '#c1272d'; roundRect(left, deckSplit, bw, bodyBottom - deckSplit, 8); ctx.fill();
  // upper deck (white)
  ctx.fillStyle = '#f4f4f2'; roundRect(left, bodyTop, bw, deckSplit - bodyTop, 10); ctx.fill();
  // red stripe
  ctx.fillStyle = '#c1272d'; ctx.fillRect(left, deckSplit - 12, bw, 12);

  // windows lower
  ctx.fillStyle = '#bfe6f5';
  const winY1 = deckSplit + 12, winH1 = (bodyBottom - deckSplit) - 26;
  drawWindowRow(left + 14, winY1, bw - 28, winH1, 5, 6);
  // windows upper
  const winY2 = bodyTop + 12, winH2 = (deckSplit - bodyTop) - 26;
  drawWindowRow(left + 14, winY2, bw - 28, winH2, 6, 7);

  // passengers visible in upper deck windows
  const shown = Math.min(passengers, 12);
  const upCount = Math.ceil(shown * 0.6), loCount = shown - upCount;
  ctx.fillStyle = '#f1c27d';
  for (let i = 0; i < upCount; i++) { const wx = left + 24 + (i % 6) * ((bw - 40) / 6); const wy = winY2 + 8; ctx.beginPath(); ctx.arc(wx, wy, 5, 0, 7); ctx.fill(); }
  for (let i = 0; i < loCount; i++) { const wx = left + 24 + (i % 5) * ((bw - 40) / 5); const wy = winY1 + 8; ctx.beginPath(); ctx.arc(wx, wy, 5, 0, 7); ctx.fill(); }

  // BRTC text on lower deck
  ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.max(13, bh*0.13)}px "Hind Siliguri",sans-serif`;
  ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText('BRTC', left + 18, deckSplit + (bodyBottom-deckSplit)*0.5);

  // route board on roof
  ctx.fillStyle = '#14213a'; roundRect(left + bw*0.18, bodyTop - 20, bw*0.64, 18, 5); ctx.fill();
  ctx.fillStyle = '#ffe14d'; ctx.font = `700 ${Math.max(10, bh*0.10)}px "Hind Siliguri",sans-serif`;
  ctx.textAlign='center'; ctx.fillText('SUST ⇄ MADINA', cx, bodyTop - 11);

  // front (right side): windshield + door
  ctx.fillStyle = '#bfe6f5'; roundRect(right - 26, bodyTop + 8, 20, deckSplit - bodyTop - 16, 4); ctx.fill();
  // door (slides open to the right)
  const doorX = right - 56, doorW = 34, doorH = (bodyBottom - deckSplit) - 16, doorY = deckSplit + 6;
  ctx.fillStyle = '#9aa3ad'; ctx.fillRect(doorX, doorY, doorW, doorH);
  ctx.fillStyle = 'rgba(150,200,230,.7)'; ctx.fillRect(doorX + 4, doorY + 4, doorW - 8, doorH - 8);
  // door opening amount
  if (door > 0.02) {
    ctx.fillStyle = '#0c1622'; ctx.fillRect(doorX + doorW*0.5, doorY, doorW*0.5 * (1-door), doorH);
    ctx.fillStyle = 'rgba(150,200,230,.7)'; ctx.fillRect(doorX + doorW*0.5 - doorW*0.5*(1-door) + 4, doorY + 4, doorW*0.5*(1-door) - 8, doorH - 8);
  }
  // headlight
  ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(right - 6, bodyBottom - 14, 5, 0, 7); ctx.fill();

  // wheels
  drawWheel(left + bw*0.20, baseY - wheelR*0.4, wheelR, wheel);
  drawWheel(right - bw*0.22, baseY - wheelR*0.4, wheelR, wheel);

  ctx.restore();
}
function drawWindowRow(x, y, w, h, n, gap) {
  const cw = (w - (n-1)*gap) / n;
  for (let i = 0; i < n; i++) { roundRect(x + i*(cw+gap), y, cw, h, 4); ctx.fill(); }
}
function roundRect(x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPopups() {
  for (const p of game.popups) {
    ctx.save();
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.font = `${p.big ? '800 26px' : '800 22px'} "Hind Siliguri","Noto Sans Bengali",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 6;
    ctx.fillText(p.text, p.x, p.y);
    ctx.restore();
  }
}

/* ----------------------------- HUD ---------------------------------- */
function drawHUD() {
  // top bar
  ctx.fillStyle = 'rgba(11,16,32,.55)'; ctx.fillRect(0, 0, W, 56);
  ctx.textBaseline = 'middle';

  // current location
  const z = currentZone();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.font = '700 18px "Hind Siliguri","Noto Sans Bengali",sans-serif';
  ctx.fillText('📍 ' + z.bn, 16, 20);
  ctx.fillStyle = '#9fd0ff'; ctx.font = '600 12px "Hind Siliguri",sans-serif';
  ctx.fillText(z.en + '  ·  SUST ➜ Madina Market', 16, 40);

  // right stats
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe14d'; ctx.font = '800 22px "Hind Siliguri",sans-serif';
  ctx.fillText('৳ ' + game.money, W - 16, 20);
  ctx.fillStyle = '#fff'; ctx.font = '700 14px "Hind Siliguri",sans-serif';
  ctx.fillText('👥 ' + game.passengers + '   🚌 ' + Math.round(game.bus.speed * SPEED_TO_KMH) + ' km/h', W - 16, 42);

  // progress bar (zones)
  const barY = H - 26, barX = 16, barW = W - 32, seg = barW / ZONES.length;
  ctx.fillStyle = 'rgba(255,255,255,.18)'; roundRect(barX, barY, barW, 10, 5); ctx.fill();
  const prog = game.bus.worldX / WORLD_END;
  ctx.fillStyle = '#39d353'; roundRect(barX, barY, barW * clamp(prog,0,1), 10, 5); ctx.fill();
  for (let i = 0; i < ZONES.length; i++) {
    const zx = barX + seg * (i + 0.5);
    ctx.fillStyle = ZONES[i].stop && ZONES[i].stop.done ? '#39d353' : (i === z.index ? '#ffd23f' : '#fff');
    ctx.beginPath(); ctx.arc(zx, barY + 5, i === z.index ? 6 : 4, 0, 7); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '600 11px "Hind Siliguri",sans-serif'; ctx.textAlign='center';
  for (let i = 0; i < ZONES.length; i++) ctx.fillText(ZONES[i].en, barX + seg*(i+0.5), barY - 8);

  // door prompt
  const ns = nearStop();
  if (state === 'playing' && ns && ns.stop.waiting > 0 && game.bus.speed < 45) {
    ctx.fillStyle = 'rgba(0,0,0,.5)'; roundRect(W/2 - 150, H*0.40, 300, 40, 10); ctx.fill();
    ctx.fillStyle = '#7CFC9B'; ctx.textAlign='center'; ctx.font = '700 16px "Hind Siliguri",sans-serif';
    ctx.fillText('␣ স্পেস চাপুন — দরজা খুলুন (' + ns.stop.waiting + ' জন)', W/2, H*0.40 + 20);
  }
  if (game.crash > 0) {
    ctx.fillStyle = 'rgba(193,39,45,.85)'; roundRect(W/2 - 130, 70, 260, 36, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font = '800 18px "Hind Siliguri",sans-serif';
    ctx.fillText('⚠ দুর্ঘটনা! গতি কমান', W/2, 88);
  }
}
function currentZone() {
  let best = ZONES[0], bd = Infinity;
  for (const z of ZONES) { const d = Math.abs(game.bus.worldX - z.x); if (d < bd) { bd = d; best = z; } }
  return best;
}

/* ------------------------- UI controls ------------------------------ */
function show(id, on) { document.getElementById(id).classList.toggle('hidden', !on); }
function startGame() {
  audio(); resetRun(); state = 'playing'; show('startScreen', false);
  show('pauseScreen', false); show('winScreen', false);
}
function resumeGame() { if (state === 'paused') { state = 'playing'; show('pauseScreen', false); } }
function togglePause() {
  if (state === 'playing') { state = 'paused'; show('pauseScreen', true); }
  else if (state === 'paused') resumeGame();
}
function restartGame() { resetRun(); state = 'playing'; show('startScreen', false); show('pauseScreen', false); show('winScreen', false); }
function winGame() {
  state = 'won';
  document.getElementById('winMoney').textContent = '৳' + game.money;
  document.getElementById('winPass').textContent = game.boarded;
  document.getElementById('winStops').textContent = game.stopsDone + '/' + ZONES.length;
  show('winScreen', true);
}

/* touch / mouse controls */
function bindBtn(id, on, off) {
  const el = document.getElementById(id);
  const down = e => { e.preventDefault(); audio(); on(); };
  const up   = e => { e.preventDefault(); if (off) off(); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
}
bindBtn('btnGas',   () => press.gas = true,   () => press.gas = false);
bindBtn('btnBrake', () => press.brake = true, () => press.brake = false);
bindBtn('btnDoor',  () => tryToggleDoor());
bindBtn('btnHorn',  () => honk());

/* ----------------------------- boot --------------------------------- */
resize();
buildWorld();          // build the static world once so the menu can render
requestAnimationFrame(loop);
