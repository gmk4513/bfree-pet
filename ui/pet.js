"use strict";

/* =====================================================================
   비프리 데스크톱 펫 — 움직임

   이 파일은 브라우저에서도 그대로 돕니다. Tauri 가 없으면 창 관련 기능만
   건너뛰고 나머지는 똑같이 동작하므로, 미리보기에서 맞춘 값이 앱에서도
   같게 나옵니다. 값을 바꿀 때는 pet.config.json 만 고치면 됩니다.
   ===================================================================== */

/* ---------- 스프라이트 ----------
   ★ 새 그림을 추가할 자리입니다.
     1. ui/sprites/ 에 png 를 넣는다 (배경 투명, 발이 그림 맨 아래에 닿게)
     2. 아래 SPRITES 에 한 줄 추가한다 (w, h 는 실제 픽셀 크기, k 는 아래 설명)
     3. 걷기라면 WALK.frames 에, 멈춤 자세라면 POSES 에 넣는다

   k = 그림 안에서 캐릭터가 얼마나 크게 그려졌는지. idle 을 1 로 둡니다.
    게임 스프라이트는 장마다 캐릭터를 그린 크기가 다릅니다. 학사모 폭을
    재 보면 idle 99px, 망치 192px 로 거의 두 배 차이가 납니다.
    k 로 나눠 주지 않으면 망치를 들 때 캐릭터가 두 배로 커집니다.
    새 그림을 넣을 때는 학사모 폭을 재서 99 로 나눈 값을 적으세요.
    (tools/measure.py 가 재 줍니다)                                    */
const SPRITES = {
  idle:   { src: "sprites/idle.png",   w: 107, h: 204, k: 1.00 },
  flex:   { src: "sprites/flex.png",   w: 231, h: 321, k: 1.49 },
  fhuman: { src: "sprites/fhuman.png", w: 227, h: 279, k: 1.94 },
  crawl2: { src: "sprites/crawl2.png", w: 293, h: 303, k: 1.74 },
  hit:    { src: "sprites/hit.png",    w: 150, h: 203, k: 0.99 },
  home1:  { src: "sprites/home1.png",  w: 247, h: 370, k: 1.75 },
  home2:  { src: "sprites/home2.png",  w: 247, h: 370, k: 1.73 },
  home3:  { src: "sprites/home3.png",  w: 247, h: 370, k: 1.75 }
};

const BASE_H = 204;        // idle 의 높이. 모든 배율의 기준
const BASE_W = 107;        // 눌리는 영역을 잡을 때 쓴다

/* 걷기.
   지금은 걷는 그림이 없어서 idle 한 장을 위아래로 까딱이게 해 흉내 냅니다.
   frames 에 두 장 이상 넣으면 그때부터 진짜 프레임 애니메이션으로 돕니다. */
const WALK = { frames: ["idle"], fps: 6 };

/* 멈췄을 때 하는 자세 */
const POSES = [
  { id: "flex",   frames: ["flex"],                    ms: 2200 },
  { id: "hammer", frames: ["fhuman"],                  ms: 1600 },
  { id: "work",   frames: ["home1", "home2", "home3"], ms: 3600, fps: 3 },
  { id: "crawl",  frames: ["crawl2"],                  ms: 2000 }
];

const FALLBACK = {
  size: 104, speed: 38, walkSec: 6, restSec: 3.5,
  bubbleGap: 26, bubbleHold: 4, bob: true,
  floorOffset: 48,
  poses: ["flex", "hammer", "work"],
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
  bobT: 0,
  clickThrough: true
};

let cfg = Object.assign({}, FALLBACK);
let curKey = "idle";

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
  // 자세가 바뀌어도 캐릭터 키가 같아야 합니다. s.k 로 나누는 게 그 일입니다.
  const scale = (cfg.size / BASE_H) / (s.k || 1);
  const w = Math.round(s.w * scale);
  const h = Math.round(s.h * scale);
  if (sprite.getAttribute("src") !== s.src) sprite.setAttribute("src", s.src);
  sprite.style.width = w + "px";
  sprite.style.height = h + "px";
  sprite.style.marginLeft = (-w / 2) + "px";
}

function render(dt) {
  pet.style.transform = "translateX(" + Math.round(S.x) + "px)";

  let bobY = 0, squash = 1;
  if (cfg.bob && !reduce && S.mode === "walk") {
    S.bobT += dt * 7.5;
    bobY = -Math.abs(Math.sin(S.bobT)) * (cfg.size * 0.045);
    squash = 1 + Math.sin(S.bobT * 2) * 0.016;
  }
  sprite.style.transform =
    "scaleX(" + (S.dir < 0 ? -1 : 1) + ") translateY(" + bobY.toFixed(2) +
    "px) scaleY(" + squash.toFixed(3) + ")";

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
    draw("idle");
  }
}

function enterHit(now) {
  S.mode = "hit"; S.pose = null;
  S.until = now + 1100;
  draw("hit");
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
  const w = BASE_W * (cfg.size / BASE_H);
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

  Object.keys(SPRITES).forEach((k) => { new Image().src = SPRITES[k].src; });

  draw("idle");
  S.x = Math.max(80, window.innerWidth * 0.3);
  S.nextSay = performance.now() + 2600;
  enterWalk(performance.now());

  await tauri.setClickThrough(true);
  requestAnimationFrame(tick);
}

boot();
