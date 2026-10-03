"use strict";

/* =====================================================================
   비프리 데스크톱 펫 — 움직임

   이 파일은 브라우저에서도 그대로 돕니다. Tauri 가 없으면 창 관련 기능만
   건너뛰고 나머지는 똑같이 동작하므로, 미리보기에서 맞춘 값이 앱에서도
   같게 나옵니다. 값을 바꿀 때는 pet.config.json 만 고치면 됩니다.
   ===================================================================== */

/* ---------- 스프라이트 ----------
   ★ 새 그림을 추가할 자리입니다.
     1. ui/sprites/ 에 PNG 를 넣는다 (배경 투명, 발이 그림 맨 아래에 닿게)
     2. 아래 SPRITES 에 한 줄 추가한다
     3. 걷기면 WALK.frames, 멈춤 자세면 POSES 에 넣는다

   w, h  파일의 실제 픽셀 크기
   ch    그 안에서 '사람'이 차지하는 세로 길이 (여백 제외)
         tools/cut_sheet.py 가 찍어 줍니다.

   ★ ch 로 프레임마다 키를 맞추면 안 됩니다.
     걸을 때 다리를 벌린 프레임은 키가 10% 낮아지는데, 그걸 억지로 같은
     높이로 늘리면 머리와 몸이 그만큼 굵어집니다. 모자 폭이 화면에서
     43 → 39 → 43 → 39 로 널뛰는 걸 실제로 보고 고쳤습니다.
     그래서 아래 REF(가장 큰 프레임) 하나를 기준으로 배율을 고정합니다. */
const SPRITES = {
  bwalk1:     { src: "sprites/bwalk1.png",    w: 135, h: 300, ch: 273 },
  bwalk2:     { src: "sprites/bwalk2.png",    w: 135, h: 300, ch: 300 },
  bwalk3:     { src: "sprites/bwalk3.png",    w: 135, h: 300, ch: 272 },
  bwalk4:     { src: "sprites/bwalk4.png",    w: 135, h: 300, ch: 297 },
  batk1:      { src: "sprites/batk1.png",     w: 214, h: 300, ch: 290 },
  batk2:      { src: "sprites/batk2.png",     w: 214, h: 300, ch: 296 },
  batk3:      { src: "sprites/batk3.png",     w: 214, h: 300, ch: 298 },
  batk4:      { src: "sprites/batk4.png",     w: 214, h: 300, ch: 298 },
  blift1:     { src: "sprites/blift1.png",    w: 264, h: 300, ch: 292 },
  blift2:     { src: "sprites/blift2.png",    w: 264, h: 300, ch: 293 },
  blift3:     { src: "sprites/blift3.png",    w: 264, h: 300, ch: 298 },
  brapwalk1:  { src: "sprites/brapwalk1.png", w: 187, h: 300, ch: 296 },
  brapwalk2:  { src: "sprites/brapwalk2.png", w: 187, h: 300, ch: 298 },
  brapwalk3:  { src: "sprites/brapwalk3.png", w: 187, h: 300, ch: 297 },
  brapwalk4:  { src: "sprites/brapwalk4.png", w: 187, h: 300, ch: 297 },
  bflex1:     { src: "sprites/bflex1.png",    w: 220, h: 300, ch: 298 },
  bflex2:     { src: "sprites/bflex2.png",    w: 220, h: 300, ch: 298 }
};

/* 동작 그룹별로 '가장 큰 프레임'을 기준 삼아 배율을 정합니다.
   시트마다 AI 가 조금씩 다른 크기로 그려서, 그룹을 섞어 한 기준으로
   재면 동작이 바뀔 때 캐릭터가 커졌다 작아졌다 합니다. */
const GROUP_OF = (key) => key.replace(/\d+$/, "");
const REF = {};
Object.keys(SPRITES).forEach((k) => {
  const g = GROUP_OF(k);
  REF[g] = Math.max(REF[g] || 0, SPRITES[k].ch);
});

const BASE_W = 135;        // 눌리는 영역을 잡을 때 쓰는 그림 폭 (bwalk 기준)

let WALK = { frames: ["bwalk1", "bwalk2", "bwalk3", "bwalk4"], fps: 8 };

/* 멈췄을 때 하는 자세 */
const POSES = [
  { id: "lift",  frames: ["blift1", "blift2", "blift3"],                  ms: 4200, fps: 3 },
  { id: "rap",   frames: ["brapwalk1", "brapwalk2", "brapwalk3", "brapwalk4"], ms: 4500, fps: 5 },
  { id: "guard", frames: ["batk2", "batk3"],                              ms: 1800, fps: 3 },
  { id: "flex",  frames: ["bflex1", "bflex2"],                            ms: 2600, fps: 2 }
];

const FALLBACK = {
  size: 104, speed: 38, walkSec: 6, restSec: 3.5,
  bubbleGap: 3, bubbleHold: 4, walkScale: 1.17,
  floorOffset: 48,
  poses: ["lift", "rap", "guard", "flex"],
  lines: ["아파트는 뭐 로보트가 짓는줄아냐?"]
};

/* ---------- Tauri 다리 ----------
   브라우저에서 열면 window.__TAURI__ 가 없습니다. 그때는 전부 빈 함수가
   되어 아무 일도 하지 않습니다. 한 벌의 코드로 둘 다 돌리기 위한 장치입니다. */
const tauri = (function () {
  const T = window.__TAURI__;
  if (!T) return { on: false, setClickThrough() {}, quit() {} };
  const win = T.window.getCurrentWindow();
  return {
    on: true,
    async setClickThrough(yes) {
      try { await win.setIgnoreCursorEvents(yes); } catch (e) {}
    },
    async quit() {
      try { await T.core.invoke("quit_app"); } catch (e) {}
    }
  };
})();

/* ---------- 상태 ---------- */
const S = {
  x: 160, dir: 1,
  mode: "walk",          // walk | rest | pose | hit
  until: 0,
  pose: null, frame: 0,
  nextSay: 0, sayUntil: 0,
  clickThrough: true
};

let cfg = Object.assign({}, FALLBACK);
let curKey = "bwalk1";

const pet    = document.getElementById("pet");
const sprite = document.getElementById("sprite");
const bubble = document.getElementById("bubble");

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ---------- 그리기 ---------- */

function draw(key) {
  const s = SPRITES[key];
  if (!s) return;
  curKey = key;
  const g = GROUP_OF(key);
  /* 그룹 안에서는 배율이 고정입니다. 프레임마다 s.ch 로 맞추면
     다리를 벌린 프레임이 억지로 늘어나 머리와 몸이 굵어집니다.

     걷기만 따로 키웁니다(walkScale). 걷기 그림은 완전한 옆모습이라
     학사모가 좁아 보입니다(폭 112, 다른 자세는 132). 그대로 두면
     걷다가 멈출 때 얼굴이 넓어진 것처럼 보입니다. */
  const adj = (g === "bwalk") ? (cfg.walkScale || 1) : 1;
  const scale = cfg.size / REF[g] * adj;
  const w = Math.round(s.w * scale);
  const h = Math.round(s.h * scale);
  if (sprite.getAttribute("src") !== s.src) sprite.setAttribute("src", s.src);
  sprite.style.width = w + "px";
  sprite.style.height = h + "px";
  sprite.style.marginLeft = (-w / 2) + "px";
}

function render(dt) {
  pet.style.transform = "translateX(" + Math.round(S.x) + "px)";

  // 까딱임은 더 이상 쓰지 않습니다. 걷는 그림이 생겨서 흉내 낼 필요가 없고,
  // 그림의 걸음과 어긋나면 오히려 떨리는 것처럼 보입니다.
  sprite.style.transform = "scaleX(" + (S.dir < 0 ? -1 : 1) + ")";

  bubble.style.bottom = (cfg.size * 1.02) + "px";
}

/* ---------- 말풍선 ---------- */

function say(text) {
  if (!text) return;
  bubble.textContent = text;
  bubble.classList.add("show");
  S.sayUntil = performance.now() + cfg.bubbleHold * 1000;
}
function hush() {
  bubble.classList.remove("show");
  S.sayUntil = 0;
}

/* ---------- 상태기계 ---------- */

function enterWalk(now) {
  S.mode = "walk"; S.pose = null;
  S.until = now + cfg.walkSec * 1000 * rand(0.7, 1.3);
  draw(WALK.frames[0]);
}

function enterRest(now) {
  const on = POSES.filter((p) => cfg.poses.indexOf(p.id) >= 0);
  if (on.length && Math.random() < 0.78) {
    S.pose = pick(on); S.mode = "pose"; S.frame = 0;
    S.until = now + S.pose.ms;
    draw(S.pose.frames[0]);
  } else {
    S.mode = "rest"; S.pose = null;
    S.until = now + cfg.restSec * 1000 * rand(0.7, 1.3);
    draw("batk1");
  }
}

function enterHit(now) {
  // 맞는 그림이 아직 없어서 공격 자세로 대신합니다.
  S.mode = "hit"; S.pose = null;
  S.until = now + 1100;
  draw("batk3");
  say(pick(cfg.lines));
  S.nextSay = now + cfg.bubbleGap * 1000;
}

function cycleFrames(now, frames, fps) {
  if (frames.length < 2) return;
  const i = Math.floor(now / (1000 / (fps || 4))) % frames.length;
  if (i !== S.frame) { S.frame = i; draw(frames[i]); }
}

/* ---------- 클릭 통과 ----------
   창은 화면 전체를 덮고 있으므로 기본은 통과시킵니다. 그러지 않으면
   바탕화면도, 아래에 있는 창도 못 누릅니다. 커서가 캐릭터 위에 왔을
   때에만 잠깐 받습니다. 커서 위치는 Rust 쪽에서 알려 줍니다. */
function petRect() {
  const w = BASE_W * (cfg.size / REF["bwalk"]) * (cfg.walkScale || 1);
  return {
    left:   S.x - w / 2,
    right:  S.x + w / 2,
    top:    window.innerHeight - cfg.floorOffset - cfg.size,
    bottom: window.innerHeight - cfg.floorOffset
  };
}

function updateClickThrough(cx, cy) {
  const r = petRect();
  const over = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  const want = !over;
  if (want !== S.clickThrough) {
    S.clickThrough = want;
    tauri.setClickThrough(want);
  }
}

if (tauri.on && window.__TAURI__.event) {
  window.__TAURI__.event.listen("cursor", (e) => {
    updateClickThrough(e.payload.x, e.payload.y);
  });
}

/* ---------- 고리 ---------- */

let last = performance.now();

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (S.mode === "walk") {
    S.x += S.dir * cfg.speed * dt;
    const pad = cfg.size * 0.45;
    const max = window.innerWidth - pad;
    if (S.x < pad) { S.x = pad; S.dir = 1; }
    if (S.x > max) { S.x = max; S.dir = -1; }
    cycleFrames(now, WALK.frames, WALK.fps);
  }

  if (S.mode === "pose" && S.pose) cycleFrames(now, S.pose.frames, S.pose.fps);

  if (now >= S.until) {
    if (S.mode === "walk") enterRest(now); else enterWalk(now);
  }

  if (S.sayUntil && now >= S.sayUntil) hush();
  if (!S.sayUntil && now >= S.nextSay) {
    say(pick(cfg.lines));
    S.nextSay = now + cfg.bubbleGap * 1000 * rand(0.8, 1.25);
  }

  render(dt);
  requestAnimationFrame(tick);
}

/* ---------- 시작 ---------- */

pet.addEventListener("click", () => enterHit(performance.now()));

// 오른쪽 버튼으로 종료. 트레이 메뉴가 붙기 전까지 유일한 탈출구입니다.
pet.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  tauri.quit();
});

async function boot() {
  try {
    const r = await fetch("pet.config.json", { cache: "no-store" });
    if (r.ok) cfg = Object.assign({}, FALLBACK, await r.json());
  } catch (e) {
    // 설정을 못 읽어도 기본값으로 돌아갑니다. 펫이 안 뜨는 쪽이 더 나쁩니다.
  }

  document.documentElement.style.setProperty("--floor", cfg.floorOffset + "px");
  if (cfg.walkFps) WALK.fps = cfg.walkFps;      // 설정에서 걸음 빠르기를 바꿀 수 있게

  Object.keys(SPRITES).forEach((k) => { new Image().src = SPRITES[k].src; });

  draw(WALK.frames[0]);
  S.x = Math.max(80, window.innerWidth * 0.3);
  S.nextSay = performance.now() + 2600;
  enterWalk(performance.now());

  await tauri.setClickThrough(true);
  requestAnimationFrame(tick);
}

boot();
