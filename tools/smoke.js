/*  pet.js 가 '실제로 돌아가는지' 봅니다.

    node tools/smoke.js

    node --check 는 문법만 봅니다. 그런데 여기서 난 사고는 전부 문법이
    멀쩡한 것들이었습니다:

      - const 를 쓰는 곳보다 아래에 선언해서, 읽는 순간 스크립트가
        통째로 죽음 (focusGraceUntil, KEYS — 두 번 똑같이 했습니다)
      - 없는 함수를 부름 (sayTick, place)
      - 지운 변수를 다음 줄에서 읽음 (despawn 뒤의 e.x — 세 번)

    전부 '한 번 돌려 보기'면 바로 나오는 것들입니다. 그래서 브라우저
    없이 돌려 봅니다. DOM 은 아무 속성이나 받아 주는 가짜를 씌우고,
    프레임도 몇 장 돌려서 step() 까지 밟아 봅니다.

    맥 키 분기도 같이 봅니다 — userAgent 를 바꿔 가며 두 번 돌립니다.   */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = path.join(__dirname, "..", "ui", "pet.js");
const code = fs.readFileSync(SRC, "utf8");

// 아무 속성이나 받아 주는 가짜 요소. 뭘 만져도 터지지 않습니다.
function fakeEl(tag) {
  const el = {
    tagName: tag, hidden: false, textContent: "", innerHTML: "",
    style: new Proxy({}, { get: () => () => {}, set: () => true }),
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    dataset: {},
    children: [],
    addEventListener() {}, removeEventListener() {},
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    appendChild(c) { return c; }, removeChild(c) { return c; },
    insertBefore(c) { return c; },
    querySelector: () => fakeEl("div"), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }),
    closest: () => null,
    setPointerCapture() {}, releasePointerCapture() {},
    click() {}, focus() {},
    get parentNode() { return null; }
  };
  el.style.setProperty = () => {};
  return el;
}

function run(label, userAgent) {
  const errors = [];
  let frames = 0;

  const win = {
    innerWidth: 1280, innerHeight: 800,
    navigator: { userAgent },
    addEventListener() {}, removeEventListener() {},
    performance: { now: () => frames * 16 },
    requestAnimationFrame(fn) {
      if (frames++ < 30) { try { fn(frames * 16); } catch (e) { errors.push("프레임: " + e); } }
    },
    fetch: () => Promise.reject(new Error("smoke: 네트워크 없음")),
    Image: function () { return { set src(v) {}, }; },
    Audio: function () { return { play: () => Promise.resolve(), cloneNode() { return this; } }; },
    AudioContext: function () {
      return {
        state: "running", resume() {},
        createBufferSource: () => ({ connect: (d) => d, start() {}, buffer: null }),
        createGain: () => ({ connect: (d) => d, gain: { value: 1 } }),
        decodeAudioData: () => Promise.resolve({ duration: 0.3 }),
        destination: {}
      };
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 1)),
    clearTimeout, setInterval: () => 0, clearInterval,
    __TAURI__: undefined
  };
  win.window = win;

  const doc = {
    getElementById: () => fakeEl("div"),
    createElement: (t) => fakeEl(t),
    querySelector: () => fakeEl("div"),
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    documentElement: fakeEl("html"),
    body: fakeEl("body"),
    hasFocus: () => true
  };

  const sandbox = Object.assign(Object.create(null), win, {
    document: doc,
    console: { log() {}, warn() {}, error(...a) { errors.push("console.error: " + a.join(" ")); } }
  });
  sandbox.globalThis = sandbox;

  // const 는 sandbox 의 속성이 되지 않습니다(브라우저에서 window 에 안
  // 붙는 것과 같습니다). 끝에 한 줄 붙여 밖으로 꺼냅니다.
  const NL = String.fromCharCode(10);
  const probed = [code, '', ";globalThis.__KEYS = (typeof KEYS !== 'undefined') ? KEYS : null;"].join(NL);

  try {
    vm.runInNewContext(probed, sandbox, { filename: "pet.js", timeout: 10000 });
  } catch (e) {
    errors.push(String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e));
  }

  const keys = sandbox.__KEYS;
  const ok = errors.length === 0;
  console.log(
    (ok ? "  통과  " : "  실패  ") + label +
    (keys ? "   (점프 " + keys.jumpLabel + " / 공격 " + keys.atkLabel + ")" : "   (KEYS 를 못 읽음)")
  );
  errors.slice(0, 5).forEach((e) => console.log("          " + e));
  return ok && !!keys;
}

console.log("pet.js 돌려 보기");
const a = run("윈도우", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
const b = run("맥    ", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
if (!a || !b) { console.log("\n실패했습니다."); process.exit(1); }
console.log("\n둘 다 끝까지 돌았습니다.");
