"""반복 녹음된 wav 에서 '한 번의 소리'만 잘라 냅니다.

    python tools/cut_sound.py jump_sound.wav ui/sound/jump.wav

받아 온 소리 파일은 같은 효과음을 1초 간격으로 여러 번 녹음한 것이라
그대로 쓰면 점프 한 번에 소리가 열 번 납니다.

하는 일
  1. 첫 번째 소리가 시작되는 지점을 찾습니다.
  2. 소리가 잦아들 때까지만 잘라 냅니다.
  3. 앞뒤에 아주 짧은 페이드를 겁니다. 안 그러면 '툭' 하는 잡음이 납니다.
  4. 16bit 44.1kHz 모노로 저장합니다. 효과음은 이걸로 충분하고 파일이 작습니다.
"""

import argparse
import io
import os
import sys
import wave

import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def load(path):
    w = wave.open(path, "rb")
    n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
    raw = w.readframes(n)
    w.close()
    if sw == 2:
        a = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    elif sw == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        v = (b[:, 0].astype(np.int32)
             | (b[:, 1].astype(np.int32) << 8)
             | (b[:, 2].astype(np.int32) << 16))
        v = np.where(v & 0x800000, v - 0x1000000, v)
        a = v.astype(np.float32) / 8388608.0
    elif sw == 1:
        a = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128) / 128.0
    else:
        sys.exit("%d byte 샘플은 지원하지 않습니다" % sw)
    return a.reshape(-1, ch).mean(axis=1), sr      # 모노로 합칩니다


def resample(a, sr, out_sr):
    if sr == out_sr:
        return a
    n = int(round(len(a) * out_sr / sr))
    return np.interp(np.linspace(0, len(a) - 1, n), np.arange(len(a)), a).astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--nth", type=int, default=1, help="몇 번째 소리를 쓸지 (기본 1)")
    ap.add_argument("--max-sec", type=float, default=1.2, help="최대 길이")
    ap.add_argument("--gain", type=float, default=0.0, help="최대 크기를 이 값에 맞춥니다 (0이면 그대로)")
    args = ap.parse_args()

    a, sr = load(args.src)
    peak = np.abs(a).max()
    win = max(1, int(sr * 0.01))
    env = np.array([np.abs(a[i:i + win]).max() for i in range(0, len(a) - win, win)])

    # 소리 덩어리의 시작점들
    on = env > peak * 0.18
    starts = [i for i in range(1, len(on)) if on[i] and not on[i - 1]]
    if not starts:
        sys.exit("소리를 찾지 못했습니다")
    if args.nth > len(starts):
        sys.exit("%d 번째 소리가 없습니다 (총 %d 개)" % (args.nth, len(starts)))
    si = starts[args.nth - 1]

    # 시작 바로 앞의 조용한 지점까지 뒤로 물러납니다
    b = si
    while b > 0 and env[b - 1] > peak * 0.02:
        b -= 1
    begin = max(0, b * win - int(sr * 0.005))

    # 잦아들 때까지 앞으로. 60ms 연속으로 조용하면 끝으로 봅니다
    quiet = 0
    e = si
    while e < len(env) - 1:
        e += 1
        quiet = quiet + 1 if env[e] < peak * 0.02 else 0
        if quiet * win > sr * 0.06:
            break
    end = min(len(a), e * win + int(sr * 0.02))
    end = min(end, begin + int(sr * args.max_sec))

    clip = a[begin:end].copy()

    # 앞뒤 페이드. 없으면 '툭' 소리가 납니다
    fi, fo = int(sr * 0.002), int(sr * 0.02)
    if len(clip) > fi + fo:
        clip[:fi] *= np.linspace(0, 1, fi)
        clip[-fo:] *= np.linspace(1, 0, fo)

    if args.gain > 0:
        m = np.abs(clip).max()
        if m > 0:
            clip = clip * (args.gain / m)

    OUT_SR = 44100
    clip = resample(clip, sr, OUT_SR)
    clip = np.clip(clip, -1, 1)

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    w = wave.open(args.out, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(OUT_SR)
    w.writeframes((clip * 32767).astype("<i2").tobytes())
    w.close()

    print("%s -> %s" % (os.path.basename(args.src), args.out))
    print("   원본 %.2f초 안에서 소리 %d개 발견, %d번째를 씀"
          % (len(a) / sr, len(starts), args.nth))
    print("   %.3f초 ~ %.3f초 를 잘라 %.3f초 (최대 크기 %.2f), %d KB"
          % (begin / sr, end / sr, len(clip) / OUT_SR, np.abs(clip).max(),
             os.path.getsize(args.out) / 1024))


if __name__ == "__main__":
    main()
