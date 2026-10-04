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
  bwalk1:      { src: "sprites/bwalk1.png", w: 135, h: 300, ch: 273 },
  bwalk2:      { src: "sprites/bwalk2.png", w: 135, h: 300, ch: 300 },
  bwalk3:      { src: "sprites/bwalk3.png", w: 135, h: 300, ch: 272 },
  bwalk4:      { src: "sprites/bwalk4.png", w: 135, h: 300, ch: 297 },
  batk1:       { src: "sprites/batk1.png", w: 214, h: 300, ch: 290 },
  batk2:       { src: "sprites/batk2.png", w: 214, h: 300, ch: 296 },
  batk3:       { src: "sprites/batk3.png", w: 214, h: 300, ch: 298 },
  batk4:       { src: "sprites/batk4.png", w: 214, h: 300, ch: 298 },
  /* sx = 가로만 줄이는 보정. 이 두 장은 다른 그림에서 따 와서, 키는 같은데
     몸이 더 넓게 그려져 있습니다(모자 50 vs 46, 어깨 35 vs 31).
     세로까지 줄이면 오른손 칠 때만 키가 작아집니다. 가로만 92% 로 맞춥니다. */
  batk5:       { src: "sprites/batk5.png", w: 213, h: 300, ch: 298, sx: 0.92 },
  batk6:       { src: "sprites/batk6.png", w: 251, h: 300, ch: 300, sx: 0.92 },
  blift1:      { src: "sprites/blift1.png", w: 264, h: 300, ch: 292 },
  blift2:      { src: "sprites/blift2.png", w: 264, h: 300, ch: 293 },
  blift3:      { src: "sprites/blift3.png", w: 264, h: 300, ch: 298 },
  brapwalk1:   { src: "sprites/brapwalk1.png", w: 187, h: 300, ch: 296 },
  brapwalk2:   { src: "sprites/brapwalk2.png", w: 187, h: 300, ch: 298 },
  brapwalk3:   { src: "sprites/brapwalk3.png", w: 187, h: 300, ch: 297 },
  brapwalk4:   { src: "sprites/brapwalk4.png", w: 187, h: 300, ch: 297 },
  brap1:       { src: "sprites/brap1.png", w: 218, h: 300, ch: 297 },
  brap2:       { src: "sprites/brap2.png", w: 218, h: 300, ch: 298 },
  brap3:       { src: "sprites/brap3.png", w: 218, h: 300, ch: 295 },
  bbrick1:     { src: "sprites/bbrick1.png", w: 386, h: 300, ch: 246 },
  bbrick2:     { src: "sprites/bbrick2.png", w: 386, h: 300, ch: 242 },
  bbrick3:     { src: "sprites/bbrick3.png", w: 386, h: 300, ch: 238 },
  bbrick4:     { src: "sprites/bbrick4.png", w: 386, h: 300, ch: 209 },
  bbrick5:     { src: "sprites/bbrick5.png", w: 386, h: 300, ch: 202 },
  bbrick6:     { src: "sprites/bbrick6.png", w: 386, h: 300, ch: 242 },
  bbrick7:     { src: "sprites/bbrick7.png", w: 386, h: 300, ch: 287 },
  bbrick8:     { src: "sprites/bbrick8.png", w: 386, h: 300, ch: 297 },
  bbrick9:     { src: "sprites/bbrick9.png", w: 386, h: 300, ch: 298 },
  bbrick10:    { src: "sprites/bbrick10.png", w: 386, h: 300, ch: 290 },
  bbrick11:    { src: "sprites/bbrick11.png", w: 386, h: 300, ch: 282 },
  bbrick12:    { src: "sprites/bbrick12.png", w: 386, h: 300, ch: 283 },
  bflex1:      { src: "sprites/bflex1.png", w: 220, h: 300, ch: 298 },
  bflex2:      { src: "sprites/bflex2.png", w: 220, h: 300, ch: 298 },

  /* 적들 */
  rwalk1:      { src: "sprites/rwalk1.png", w: 166, h: 300, ch: 297 },
  rwalk2:      { src: "sprites/rwalk2.png", w: 166, h: 300, ch: 297 },
  rwalk3:      { src: "sprites/rwalk3.png", w: 166, h: 300, ch: 297 },
  rwalk4:      { src: "sprites/rwalk4.png", w: 166, h: 300, ch: 298 },
  ratk1:       { src: "sprites/ratk1.png", w: 231, h: 300, ch: 298 },
  ratk2:       { src: "sprites/ratk2.png", w: 231, h: 300, ch: 285 },
  ratk3:       { src: "sprites/ratk3.png", w: 231, h: 300, ch: 297 },
  ratk4:       { src: "sprites/ratk4.png", w: 231, h: 300, ch: 294 },
  ratk5:       { src: "sprites/ratk5.png", w: 231, h: 300, ch: 287 },
  ratk6:       { src: "sprites/ratk6.png", w: 231, h: 300, ch: 291 },
  g1walk1:     { src: "sprites/g1walk1.png", w: 191, h: 300, ch: 285 },
  g1walk2:     { src: "sprites/g1walk2.png", w: 191, h: 300, ch: 277 },
  g1walk3:     { src: "sprites/g1walk3.png", w: 191, h: 300, ch: 277 },
  g1walk4:     { src: "sprites/g1walk4.png", w: 191, h: 300, ch: 294 },
  g1walk5:     { src: "sprites/g1walk5.png", w: 191, h: 300, ch: 290 },
  g1walk6:     { src: "sprites/g1walk6.png", w: 191, h: 300, ch: 287 },
  g1walk7:     { src: "sprites/g1walk7.png", w: 191, h: 300, ch: 283 },
  g1walk8:     { src: "sprites/g1walk8.png", w: 191, h: 300, ch: 298 },
  g2walk1:     { src: "sprites/g2walk1.png", w: 174, h: 300, ch: 269 },
  g2walk2:     { src: "sprites/g2walk2.png", w: 174, h: 300, ch: 298 },
  g2walk3:     { src: "sprites/g2walk3.png", w: 174, h: 300, ch: 285 },
  g2walk4:     { src: "sprites/g2walk4.png", w: 174, h: 300, ch: 271 },
  g2walk5:     { src: "sprites/g2walk5.png", w: 174, h: 300, ch: 297 },
  g2walk6:     { src: "sprites/g2walk6.png", w: 174, h: 300, ch: 286 }
};

/* 적 종류. 노인은 아직 공격 그림이 없어서 걷기 중 큰 동작을 빌려 씁니다. */
const ENEMIES = {
  robot: { label: "로보트",     walk: ["rwalk1","rwalk2","rwalk3","rwalk4"], atk: ["ratk1","ratk2","ratk3"] },
  g1:    { label: "노인1", walk: ["g1walk1","g1walk2","g1walk3","g1walk4","g1walk5","g1walk6","g1walk7","g1walk8"], atk: ["g1walk4","g1walk8"] },
  g2:    { label: "노인2", walk: ["g2walk1","g2walk2","g2walk3","g2walk4","g2walk5","g2walk6"], atk: ["g2walk4","g2walk2"] }
};

/* 적이 움직이는 빠르기. 비프리 걷는 속도와 따로 둡니다.
   예전에는 비프리 속도의 배수였는데, 그러면 비프리를 빠르게 하는 순간
   적도 같이 달려들어서 다가오는 맛이 사라집니다.                        */
const ENEMY_SPEED = 76;    // 다가오는 속도 (px/초)
const ENEMY_FLEE  = 130;   // 피 다 깎이고 도망가는 속도 (px/초)

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

let WALK = { frames: ["bwalk1", "bwalk2", "bwalk3", "bwalk4"], fps: 4 };
/* 공격은 왼손 -> 오른손 -> 왼손 ... 으로 번갈아 나갑니다.
   한쪽 손만 계속 뻗으면 때리는 게 아니라 같은 그림을 반복하는 걸로 보입니다.
   batk3 이 왼손, batk6 이 오른손이고 batk2 / batk5 가 각자의 준비 자세입니다. */
const ATK_L = ["batk1", "batk2", "batk3", "batk4"];
const ATK_R = ["batk1", "batk5", "batk6", "batk5"];

/* 동작과 그 동작에서 할 말을 한 곳에 묶습니다. 대사를 따로 두면
   "이 자세엔 무슨 말을 하지?" 를 코드 두 군데서 찾게 됩니다. */
const SAY_RAP = [
  "내 가사는 내가 사는 삶에서 나오는 시",
  "내 rap 핫뜨거 like 써머",
  "인도로 걸어 인도로 걸어"
];
/* 걸으면서 랩(프리스타일)은 서서 랩(공연)과 가사를 나눠 씁니다.
   같은 가사를 두 자세에서 돌리면 금방 질립니다. */
const SAY_FREE = [
  "핫도그 하나 사먹으려는데",
  "멤버쉽이 필요하다는 '코스트코'",
  "처럼 속이 정말 '좁은놈'",
  "이건 음악이 아닌 나만의 '독립운동'"
];
const SAY_BRICK = [
  "노가다보다 랩레슨이 낫지 않냐?",
  "노가다가 훨씬 낫지 이사람아",
  "그렇게 일하기가 싫냐?",
  "아파트는 뭐 아파트가 짓는줄 아냐?",
  "다 사람이 하는거야 임마",
  "내가 여기있는 사람들 모두 일자리를 뺏어버릴거다!"
];
const SAY_LIFT = [
  "건강하지, 젊지, 돈 벌며는 고마운거야~",
  "그렇게 일하기가 싫으냐?"
];

/* 멈췄을 때 돌아가며 하는 동작.
   lines 를 적으면 그 동작일 때는 이 대사만 합니다.
   안 적으면 pet.config.json 의 lines(기본 7개)를 씁니다. */
const POSES = [
  { id: "lift",    frames: ["blift1","blift2","blift3"],                        fps: 3, ms: 4500, lines: SAY_LIFT },
  { id: "rap",     frames: ["brap1","brap2","brap3"],                           fps: 3, ms: 4200, lines: SAY_RAP },
  { id: "rapwalk", frames: ["brapwalk1","brapwalk2","brapwalk3","brapwalk4"],   fps: 4, ms: 5000, lines: SAY_FREE, moves: true },
  { id: "brick",   frames: ["bbrick4","bbrick5","bbrick6","bbrick7","bbrick8","bbrick9"], fps: 3, ms: 5200, lines: SAY_BRICK },
  { id: "flex",    frames: ["bflex1","bflex2"],                                 fps: 2, ms: 2600 }
];

const FALLBACK = {
  size: 104, speed: 50, walkSec: 6, restSec: 3.5,
  bubbleGap: 3, bubbleHold: 4, walkScaleX: 1.17, walkScaleY: 1.00,
  floorOffset: 48,
  poses: ["lift", "rap", "rapwalk", "brick", "flex"],
  lines: ["아파트는 뭐 로보트가 짓는줄아냐?"]
};

/* ---------- Tauri 다리 ----------
   브라우저에서 열면 window.__TAURI__ 가 없습니다. 그때는 전부 빈 함수가
   되어 아무 일도 하지 않습니다. 한 벌의 코드로 둘 다 돌리기 위한 장치입니다. */
const tauri = (function () {
  const T = window.__TAURI__;
  if (!T) return { on: false, setClickThrough() {}, quit() {}, focus() {} };
  const win = T.window.getCurrentWindow();
  return {
    on: true,
    async setClickThrough(yes) {
      try { await win.setIgnoreCursorEvents(yes); } catch (e) {}
    },
    async quit() {
      try { await T.core.invoke("quit_app"); } catch (e) {}
    },
    async focus() {
      // 키보드를 받으려면 창이 포커스를 가져야 합니다.
      try { await win.setFocus(); } catch (e) {}
    }
  };
})();

/* ---------- 상태 ---------- */
const S = {
  x: 160, dir: 1,
  mode: "walk",          // walk | rest | pose | hit
  until: 0,
  pose: null, frame: 0,
  nextSay: 0, sayUntil: 0, turnAt: 0, sayIdx: 0, poseIdx: 0,
  y: 0, vy: 0, manual: false, atkUntil: 0, atkFrom: 0, atkHitDone: true, atkRight: false,
  keys: { left: false, right: false, jump: false, atk: false },
  clickThrough: true
};

let cfg = Object.assign({}, FALLBACK);
let curKey = "bwalk1";

const pet    = document.getElementById("pet");
const sprite = document.getElementById("sprite");
const bubble = document.getElementById("bubble");

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const rand = (a, b) => a + Math.random() * (b - a);

/* 소리. 받은 파일은 같은 효과음이 1초 간격으로 여러 번 녹음돼 있어서
   tools/cut_sound.py 로 첫 한 방만 잘라 썼습니다.

   ★ new Audio() 로 틀지 마세요. 이 wav 들은 <audio> 로 열면
     networkState 가 2(받는 중)에 멈춘 채 readyState 가 영영 0 입니다.
     오류도 안 납니다 — play() 는 그냥 조용히 아무 소리도 안 냅니다.
     같은 파일을 WebAudio 로 받으면 바로 풀립니다(확인함).

   그래서 한 번 받아 디코드해 두고, 재생은 그 버퍼로 합니다. 효과음을
   겹쳐 트는 데도 이쪽이 맞습니다 — 한 번 울릴 때마다 노드 하나면 되고,
   cloneNode 처럼 매번 미디어 요소를 새로 만들지 않습니다.           */
const AC = window.AudioContext || window.webkitAudioContext;
const BUF = {};
let actx = null;
if (AC) {
  actx = new AC();
  ["jump", "attack", "hit"].forEach((k) => {
    fetch("sound/" + k + ".wav")
      .then((r) => r.arrayBuffer())
      .then((b) => actx.decodeAudioData(b))
      .then((buf) => { BUF[k] = buf; })
      // 소리가 없다고 펫이 멈추면 안 됩니다. 다만 조용히 삼키지는
      // 않습니다 — 소리가 안 나는 이유를 못 찾는 게 더 비쌉니다.
      .catch((e) => console.warn("[소리] " + k + " 못 읽음:", e));
  });
}
function play(k) {
  const buf = BUF[k];
  if (!actx || !buf) return;
  // 브라우저는 사용자가 한 번 건드리기 전까지 소리를 재워 둡니다.
  if (actx.state === "suspended") actx.resume();
  try {
    const s = actx.createBufferSource();
    s.buffer = buf;
    const g = actx.createGain();
    g.gain.value = 0.55;
    s.connect(g).connect(actx.destination);
    s.start();
  } catch (e) {}
}
// 첫 조작 때 깨워 둡니다. 안 그러면 첫 소리가 빕니다.
["pointerdown", "keydown"].forEach((ev) => {
  window.addEventListener(ev, () => { if (actx && actx.state === "suspended") actx.resume(); }, { once: true });
});
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ---------- 그리기 ---------- */

function draw(key) {
  const s = SPRITES[key];
  if (!s) return;
  curKey = key;
  const g = GROUP_OF(key);
  /* 그룹 안에서는 배율이 고정입니다. 프레임마다 s.ch 로 맞추면
     다리를 벌린 프레임이 억지로 늘어나 머리와 몸이 굵어집니다.

     걷기만 따로 늘립니다. 걷기 그림은 완전한 옆모습이라 학사모가 좁아
     보입니다(폭 112, 다른 자세는 132). 그대로 두면 걷다가 멈출 때
     얼굴이 넓어진 것처럼 보입니다.

     ★ 가로만 늘립니다. 가로세로를 같이 늘리면 걸을 때 키까지 커져서
       다른 자세보다 커 보입니다. 가로만 늘리면 키는 그대로 두고
       얼굴만 키울 수 있습니다. 다리를 늘릴 필요가 없습니다. */
  const ax = ((g === "bwalk") ? (cfg.walkScaleX || 1) : 1) * (s.sx || 1);
  const ay = (g === "bwalk") ? (cfg.walkScaleY || 1) : 1;
  const scale = cfg.size / REF[g];
  const w = Math.round(s.w * scale * ax);
  const h = Math.round(s.h * scale * ay);
  if (sprite.getAttribute("src") !== s.src) sprite.setAttribute("src", s.src);
  sprite.style.width = w + "px";
  sprite.style.height = h + "px";
  sprite.style.marginLeft = (-w / 2) + "px";
}

function render(dt) {
  pet.style.transform =
    "translateX(" + Math.round(S.x) + "px) translateY(" + Math.round(-S.y) + "px)";

  // 까딱임은 더 이상 쓰지 않습니다. 걷는 그림이 생겨서 흉내 낼 필요가 없고,
  // 그림의 걸음과 어긋나면 오히려 떨리는 것처럼 보입니다.
  sprite.style.transform = "scaleX(" + (S.dir < 0 ? -1 : 1) + ")";

  // 캐릭터 머리 위. 1.02 면 꼬리가 모자를 살짝 가립니다.
  bubble.style.bottom = (cfg.size * 1.16) + "px";

}

/* ---------- 말풍선 ---------- */

function linesNow() {
  // 지금 하고 있는 동작의 대사. 자세가 아니거나(걷기·수동 조작)
  // 그 자세에 대사가 없으면 설정의 기본 대사.
  if (!S.manual && S.mode === "pose" && S.pose && S.pose.lines) return S.pose.lines;
  return cfg.lines;
}
/* 대사는 무작위가 아니라 '순서대로' 돕니다. 무작위면 같은 말이 연달아
   나오거나 어떤 말은 한참 안 나옵니다. */
function say(text) {
  const L = linesNow();
  bubble.textContent = text || L[S.sayIdx % L.length];
  if (!text) S.sayIdx += 1;
  bubble.classList.add("show");
  S.sayUntil = performance.now() + cfg.bubbleGap * 1000;   // 다음 말이 바로 이어집니다
}
function hush() {
  bubble.classList.remove("show");
  S.sayUntil = 0;
}

/* ---------- 상태기계 ---------- */

function enterWalk(now) {
  S.mode = "walk"; S.pose = null;
  S.until = now + cfg.walkSec * 1000 * rand(0.7, 1.3);
  S.turnAt = now + rand(1200, 4000);
  S.sayIdx = 0;                 // 걷기 대사도 첫 줄부터
  draw(WALK.frames[0]);
}

/* 그 자세의 대사가 한 바퀴 다 돌 때까지 자세를 유지합니다.
   첫 대사가 0.4초 뒤에 뜨고 그 뒤로 bubbleGap 초마다 넘어가므로,
   n 줄이면 0.4 + n*gap 초가 필요합니다. 끝을 자르지 않게 조금 더 둡니다.
   전에는 ms 를 손으로 적어 둬서 벽돌쌓기(6줄)가 2~3줄만 나오고 끊겼습니다. */
function poseDuration(q) {
  if (!q.lines) return q.ms;          // 제 대사가 없는 자세는 원래 길이대로
  /* 대사는 0.4초 뒤 첫 줄, 그 뒤로 gap 마다 다음 줄이 뜹니다.
     n 번째 줄이 뜨는 시각이 0.4 + (n-1)*gap 이고 그 줄이 gap 동안
     떠 있으니, 딱 0.4 + n*gap 에서 끝내야 합니다.
     여유를 더 주면 그 틈에 n+1 번째(= 첫 줄로 되감긴) 대사가 하나 더
     뜹니다. 실제로 그렇게 한 개 더 나왔습니다. */
  return 400 + q.lines.length * cfg.bubbleGap * 1000;
}

function enterRest(now) {
  const on = POSES.filter((p) => cfg.poses.indexOf(p.id) >= 0);
  if (on.length && Math.random() < 0.78) {
    // 무작위로 고르면 같은 자세가 연달아 나오거나 어떤 자세는 한참 안
    // 나옵니다. POSES 에 적힌 순서 그대로 돕니다.
    S.pose = on[S.poseIdx % on.length]; S.poseIdx += 1;
    S.mode = "pose"; S.frame = 0;
    S.until = now + poseDuration(S.pose);
    draw(S.pose.frames[0]);
    S.sayIdx = 0; hush(); S.nextSay = now + 400;   // 자세가 바뀌면 그 자세의 첫 줄부터
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
  say();
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
  const w = BASE_W * (cfg.size / REF["bwalk"]) * (cfg.walkScaleX || 1);
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

  /* 트레이 메뉴. Rust 는 누른 항목의 id 만 보내고, 뜻은 여기서 풉니다.
     동작을 추가할 때 Rust 를 안 고쳐도 되게 하려고 이렇게 나눴습니다. */
  window.__TAURI__.event.listen("menu", (e) => {
    const id = String(e.payload || "");
    if (id.startsWith("spawn:")) { spawn(id.slice(6)); return; }
    if (id.startsWith("pose:")) {
      const want = id.slice(5);
      if (S.manual) goAuto();
      if (want === "flex") { S.mode = "flex2"; S.until = performance.now() + 3000; return; }
      const q = POSES.find((x) => x.id === want);
      if (q) {
        S.pose = q; S.mode = "pose"; S.frame = 0;
        S.until = performance.now() + poseDuration(q);
        S.sayIdx = 0; hush(); S.nextSay = performance.now() + 400;
        draw(q.frames[0]);
      }
      return;
    }
    if (id === "mode:manual") { if (S.manual) goAuto(); else goManual(); }
  });
}

/* ---------- 적 ----------
   여러 마리를 동시에 띄울 수 있습니다. 소환할 때마다 하나씩 더 나옵니다.
   그래서 전역 변수 하나가 아니라 배열이고, 각자 제 DOM 을 들고 있습니다. */
const ES = [];

function spawn(kind) {
  const d = ENEMIES[kind];
  if (!d) return;
  const el = document.createElement("div");
  el.className = "pet enemy";
  el.innerHTML = '<div class="hp"><i style="width:100%"></i></div><img alt="">';
  document.body.insertBefore(el, pet);     // 비프리보다 뒤에 섭니다
  const side = Math.random() < 0.5 ? -1 : 1;
  ES.push({
    kind, def: d, el,
    img: el.querySelector("img"),
    bar: el.querySelector(".hp"),
    fill: el.querySelector(".hp i"),
    x: side > 0 ? window.innerWidth + 50 : -50,
    hp: 4, maxHp: 4,
    mode: "chase", until: 0, since: performance.now(),
    kb: 0, fleeDir: side
  });
}

function despawn(e) {
  const i = ES.indexOf(e);
  if (i >= 0) ES.splice(i, 1);
  if (e.el && e.el.parentNode) e.el.parentNode.removeChild(e.el);
  if (!ES.length && !S.manual) { S.mode = "flex2"; S.until = performance.now() + 2600; }
}

function nearest() {
  let best = null, bd = 1e9;
  for (const e of ES) {
    if (e.mode === "flee") continue;
    const d = Math.abs(e.x - S.x);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function drawInto(img, key, targetH, faceLeft) {
  const sp = SPRITES[key];
  if (!sp) return;
  const scale = targetH / REF[GROUP_OF(key)];
  const w = Math.round(sp.w * scale * (sp.sx || 1)), h = Math.round(sp.h * scale);
  if (img.getAttribute("src") !== sp.src) img.setAttribute("src", sp.src);
  img.style.width = w + "px";
  img.style.height = h + "px";
  img.style.marginLeft = (-w / 2) + "px";
  img.style.transform = "scaleX(" + (faceLeft ? -1 : 1) + ")";
}

function enemyTick(e, now, dt) {
  const ed = e.def;
  const wf = ed.walk[Math.floor(now / (1000 / WALK.fps)) % ed.walk.length];
  const EH = cfg.enemySize || Math.round(cfg.size * 1.23);

  // 맞고 밀려나는 중이면 그만큼 더 밀립니다. 금방 잦아듭니다.
  if (e.kb) { e.x += e.kb * dt; e.kb *= 0.86; if (Math.abs(e.kb) < 6) e.kb = 0; }

  if (e.mode === "flee") {
    e.x += e.fleeDir * ENEMY_FLEE * dt;
    drawInto(e.img, wf, EH, e.fleeDir < 0);
    placeEnemy(e, EH);
    if (e.x < -200 || e.x > window.innerWidth + 200 || now - e.since > 7000) despawn(e);
    return;
  }

  const gap = e.x - S.x;
  if (Math.abs(gap) > cfg.size * 1.0) {
    e.x += (gap > 0 ? -1 : 1) * ENEMY_SPEED * dt;
    drawInto(e.img, wf, EH, gap > 0);
    e.until = now + 800;
  } else {
    drawInto(e.img, ed.atk[Math.min(ed.atk.length - 1, Math.floor((now % 900) / 300))], EH, gap > 0);
    if (now >= e.until) e.until = now + 1100;   // 비프리는 무적이라 깎이지 않습니다
  }
  placeEnemy(e, EH);
}

function placeEnemy(e, EH) {
  e.el.style.transform = "translateX(" + Math.round(e.x) + "px)";
  e.bar.style.bottom = (EH * 1.02) + "px";
  e.fill.style.width = Math.max(0, e.hp / e.maxHp * 100) + "%";
}

/* 비프리의 주먹 판정. 한 번 휘두를 때 한 번만, 닿는 거리에서만. */
function swing(now) {
  let landed = false;
  for (const e of ES) {
    if (e.mode === "flee") continue;
    const gap = e.x - S.x;
    const facing = gap > 0 ? 1 : -1;
    if (Math.abs(gap) < cfg.size * 1.15 && facing === S.dir) {
      e.hp -= 1;
      e.kb = facing * cfg.size * 4.2;
      landed = true;
      if (e.hp <= 0) { e.mode = "flee"; e.fleeDir = facing; e.since = now; }
    }
  }
  if (landed) play("hit");
}

/* ---------- 수동 조작 ----------
   ← → 좌우,  Alt 점프,  Ctrl 공격.
   점프는 제자리가 아니라 지금 가던 방향으로 그대로 날아갑니다.
   공중에서는 bwalk3 한 장을 씁니다. 따로 점프 그림이 없습니다.

   ★ 앱에서는 창이 포커스를 가져야 키가 들어옵니다. 이 창은 평소
     포커스를 안 받게 돼 있어서(쓰던 창에서 포커스를 뺏지 않으려고),
     캐릭터를 한 번 눌러야 조작이 시작됩니다. */
const JUMP_V = 4.3;    // cfg.size 의 몇 배로 튀어오를지
const GRAV   = 15;     // cfg.size 의 몇 배로 떨어질지

function tryAttack() {
  const now = performance.now();
  if (now < S.atkUntil) return;           // 휘두르는 중엔 또 못 칩니다
  S.atkUntil = now + 560;
  S.atkFrom = now;
  S.atkHitDone = false;
  S.atkRight = !S.atkRight;               // 왼손 / 오른손 번갈아
  play("attack");
}
function atkFrames() { return S.atkRight ? ATK_R : ATK_L; }
function tryJump() {
  if (S.y > 0 || S.vy !== 0) return;      // 공중에서 또 못 뜁니다
  S.vy = cfg.size * JUMP_V;
  play("jump");
}
function goManual() {
  if (S.manual) return;
  S.manual = true;
  S.mode = "walk"; S.pose = null; S.sayIdx = 0; hush();
  S.nextSay = performance.now() + 400;
  tauri.focus();
}
function goAuto() {
  S.manual = false;
  S.keys.left = S.keys.right = S.keys.jump = S.keys.atk = false;
  S.y = 0; S.vy = 0;
  S.mode = "walk"; S.until = performance.now() + 3000; S.turnAt = performance.now() + 1500;
}
function onKey(e, down) {
  const k = e.key;
  if (k === "ArrowLeft")       { S.keys.left = down;  if (down) goManual(); }
  else if (k === "ArrowRight") { S.keys.right = down; if (down) goManual(); }
  // Alt 는 누르고 있는 동안 눌린 상태로 둡니다. 착지하는 순간 고리에서
  // 다시 뛰게 해서, 누르고 있으면 연속으로 뜁니다.
  else if (k === "Alt")        { S.keys.jump = down; if (down) { goManual(); tryJump(); } }
    // Alt 와 같은 방식. 누르고 있으면 한 번 끝날 때마다 다시 칩니다.
  else if (k === "Control")    { S.keys.atk = down; if (down) { goManual(); tryAttack(); } }
  else if (k === "Escape")     { if (down) goAuto(); }
  else return;
  e.preventDefault();   // Alt 는 메뉴로, 방향키는 스크롤로 새어 나갑니다
}
window.addEventListener("keydown", (e) => onKey(e, true));
window.addEventListener("keyup",   (e) => onKey(e, false));

/* ---------- 고리 ---------- */

let last = performance.now();

/* 한 프레임에서 오류가 나도 고리는 계속 돌게 합니다.
   한 줄의 오류로 화면이 통째로 얼어붙는 일을 여러 번 겪었습니다.
   멈추는 것보다 한 프레임 건너뛰는 쪽이 낫습니다. */
function tick(now) {
  try { step(now); } catch (err) {
    if (!tick.warned) { tick.warned = true; console.error("한 프레임 건너뜀:", err); }
  }
  requestAnimationFrame(tick);
}

function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // 적이 있으면 평소 동작 대신 싸운다 (자동일 때)
  if (!S.manual && ES.length) {
    const swinging0 = now < S.atkUntil;
    const t = nearest();
    if (t) {
      const gap = t.x - S.x;
      if (!swinging0) S.dir = gap > 0 ? 1 : -1;   // 치는 동안엔 방향 고정
      /* 주먹을 뻗는 동안은 무엇보다 먼저 그 모션을 그립니다.
         때린 순간 적이 뒤로 밀려나는데, 거리부터 재면 뻗던 주먹이
         중간에 걷기 그림으로 바뀌어 버립니다. 그러면 가만히 서 있는데
         적만 날아가는 것처럼 보입니다. 수동 조작과 같은 규칙입니다 —
         치는 동안에도 걸음은 그대로 갑니다.                        */
      const far = Math.abs(gap) > cfg.size * 1.05;
      if (far) S.x += S.dir * cfg.speed * 1.6 * dt;

      if (swinging0) {
        const F = atkFrames();
        draw(F[Math.min(F.length - 1, Math.floor((now - S.atkFrom) / 140))]);
      } else if (far) {
        cycleFrames(now, WALK.frames, WALK.fps);
      } else {
        draw("batk2");
        if (now >= S.atkUntil + 220) tryAttack();
      }
    } else {
      draw("batk2");
    }
    const pd = cfg.size * 0.45;
    if (S.x < pd) S.x = pd;
    if (S.x > window.innerWidth - pd) S.x = window.innerWidth - pd;

    if (swinging0 && !S.atkHitDone && now - S.atkFrom > 170) { S.atkHitDone = true; swing(now); }
    for (let i = ES.length - 1; i >= 0; i--) enemyTick(ES[i], now, dt);
    render(dt);
    return;
  }

  if (S.manual) {
    const swinging = now < S.atkUntil;
    const mv = (S.keys.right ? 1 : 0) - (S.keys.left ? 1 : 0);
    // 주먹을 뻗는 동안에는 '방향만' 고정합니다. 걸음은 그대로 갑니다.
    // 공중에서 치면서도 앞으로 날아갈 수 있어야 합니다.
    if (mv) {
      if (!swinging) S.dir = mv;
      S.x += mv * cfg.speed * 2.4 * dt;
    }

    // 누르고 있으면 끝나는 대로 다시 뛰고, 다시 칩니다
    if (S.keys.jump) tryJump();
    if (S.keys.atk) tryAttack();

    if (S.y > 0 || S.vy !== 0) {
      S.vy -= cfg.size * GRAV * dt;
      S.y  += S.vy * dt;
      if (S.y <= 0) { S.y = 0; S.vy = 0; }
    }
    const mpad = cfg.size * 0.45;
    if (S.x < mpad) S.x = mpad;
    if (S.x > window.innerWidth - mpad) S.x = window.innerWidth - mpad;

    if (swinging) {
      // 공중이든 땅이든 주먹이 먼저입니다. 점프 중에도 그대로 뻗습니다.
      const F = atkFrames();
      draw(F[Math.min(F.length - 1, Math.floor((now - S.atkFrom) / 140))]);
    } else if (S.y > 0) {
      draw("bwalk3");
    } else if (mv) {
      cycleFrames(now, WALK.frames, WALK.fps);
    } else draw("batk1");

    if (swinging && !S.atkHitDone && now - S.atkFrom > 170) { S.atkHitDone = true; swing(now); }
    for (let i = ES.length - 1; i >= 0; i--) enemyTick(ES[i], now, dt);

    render(dt);
    return;
  }

  if (S.mode === "flex2") {
    // 적을 다 쫓아낸 뒤 알통 한 번
    const f = ["bflex1", "bflex2"];
    draw(f[Math.floor(now / 450) % f.length]);
    if (now >= S.until) { S.mode = "walk"; S.until = now + 4000; S.turnAt = now + 1500; }
    render(dt);
    return;
  }

  if (S.mode === "walk") {
    // 이게 '걷는 속도' 그 자체입니다. 50px/초로 고정했습니다.
    // 비프리의 쫓아가기 / 수동 이동 속도는 이 값의 배수입니다.
    // 적 속도는 따로입니다 — ENEMY_SPEED 를 보세요.
    S.x += S.dir * cfg.speed * dt;
    const pad = cfg.size * 0.45;
    const max = window.innerWidth - pad;
    // 벽에 닿으면 돌아서고, 그 전에도 가끔 제 마음대로 방향을 바꿉니다.
    // 끝까지 갔다가 되돌아오기만 하면 왕복 기계처럼 보입니다.
    if (S.x < pad) { S.x = pad; S.dir = 1; S.turnAt = now + rand(1200, 4000); }
    if (S.x > max) { S.x = max; S.dir = -1; S.turnAt = now + rand(1200, 4000); }
    if (now >= S.turnAt) {
      if (Math.random() < 0.55) S.dir = -S.dir;
      S.turnAt = now + rand(1200, 4000);
    }
    cycleFrames(now, WALK.frames, WALK.fps);
  }

  if (S.mode === "pose" && S.pose) {
    cycleFrames(now, S.pose.frames, S.pose.fps);
    if (S.pose.moves) S.x += S.dir * cfg.speed * 0.5 * dt;   // 걸으면서 랩
  }

  if (now >= S.until) {
    if (S.mode === "walk") enterRest(now); else enterWalk(now);
  }

  if (S.sayUntil && now >= S.sayUntil) hush();
  if (!S.sayUntil && now >= S.nextSay) {
    say();
    S.nextSay = now + cfg.bubbleGap * 1000 * rand(0.8, 1.25);
  }

  render(dt);
}

/* ---------- 시작 ---------- */

pet.addEventListener("click", () => { goManual(); say(); });

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
