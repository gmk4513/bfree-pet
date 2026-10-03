"""AI 가 만들어 준 그림을 스프라이트로 바꿉니다.

    python tools/import_sprite.py 받은그림.png walk --frames 4
    python tools/import_sprite.py 받은그림.png barbell --frames 2
    python tools/import_sprite.py 받은그림.png rap

ui/sprites/ 에 walk1.png ... walk4.png 로 저장하고,
pet.js 의 SPRITES 에 넣을 줄까지 찍어 줍니다.

하는 일
  1. 마젠타(#FF00FF) 배경을 지웁니다. AI 는 투명 배경을 잘 못 만들지만
     단색 배경은 잘 만듭니다. 그래서 키 컬러를 쓰고 여기서 지웁니다.
  2. 여러 프레임이 한 장에 가로로 붙어 있으면 잘라 냅니다.
  3. ★ 프레임들을 각자 자르지 않고 '한 덩어리로' 자릅니다.
     프레임마다 따로 자르면 캐릭터가 프레임이 바뀔 때마다 튑니다.
  4. 학사모 폭을 재서 k 값을 계산해 줍니다.
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


IDLE_CAP = 99.0        # idle.png 의 학사모 폭. k 의 기준
OUT_DIR = os.path.join("ui", "sprites")


def key_out(im, tol=70):
    """마젠타 배경을 투명하게. 흰 배경으로 와도 가장자리 색으로 추정해 지웁니다."""
    im = im.convert("RGBA")
    a = np.asarray(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]

    # 마젠타: 빨강·파랑은 높고 초록은 낮다
    mask = (r > 150) & (b > 150) & (g < 110)

    if mask.mean() < 0.02:
        # 마젠타가 거의 없으면 네 모서리 색을 배경으로 보고 지웁니다
        corners = np.array([a[0, 0, :3], a[0, -1, :3], a[-1, 0, :3], a[-1, -1, :3]])
        bg = corners.mean(axis=0)
        dist = np.sqrt(((a[..., :3] - bg) ** 2).sum(axis=2))
        mask = dist < tol
        print("  마젠타가 없어 모서리 색 %s 을 배경으로 봤습니다" % bg.astype(int))

    out = a.copy()
    out[..., 3] = np.where(mask, 0, a[..., 3])
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def union_box(frames):
    """모든 프레임을 담는 하나의 상자. 프레임이 바뀔 때 캐릭터가 튀지 않게 합니다."""
    L, T, R, B = 10 ** 9, 10 ** 9, -1, -1
    for f in frames:
        al = np.asarray(f)[..., 3]
        ys, xs = np.nonzero(al > 12)
        if not len(xs):
            continue
        L, T = min(L, xs.min()), min(T, ys.min())
        R, B = max(R, xs.max()), max(B, ys.max())
    if R < 0:
        sys.exit("그림이 통째로 비어 있습니다. 배경 지우기가 과했는지 보세요.")
    return L, T, R + 1, B + 1


def cap_width(im):
    a = np.asarray(im).astype(int)
    al, r, g, b = a[..., 3], a[..., 0], a[..., 1], a[..., 2]
    dark = (al > 120) & (r < 80) & (g < 80) & (b < 80)
    ys = np.nonzero(al.max(axis=1) > 12)[0]
    if not len(ys):
        return 0
    top, bot = ys.min(), ys.max()
    band = dark[top:top + max(1, int((bot - top) * 0.34))]
    w = [np.nonzero(row)[0].max() - np.nonzero(row)[0].min() + 1
         for row in band if np.count_nonzero(row) > 3]
    return max(w) if w else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="AI 가 준 PNG")
    ap.add_argument("name", help="스프라이트 이름 (walk, barbell, rap ...)")
    ap.add_argument("--frames", type=int, default=1, help="가로로 붙은 프레임 수")
    ap.add_argument("--height", type=int, default=0,
                    help="세로 몇 px 로 줄일지. 0 이면 그대로 (보통 240 정도)")
    args = ap.parse_args()

    im = key_out(Image.open(args.src))
    W, H = im.size

    if args.frames > 1:
        step = W // args.frames
        frames = [im.crop((i * step, 0, (i + 1) * step, H)) for i in range(args.frames)]
    else:
        frames = [im]

    L, T, R, B = union_box(frames)
    frames = [f.crop((L, T, R, B)) for f in frames]

    if args.height:
        k = args.height / frames[0].height
        frames = [f.resize((max(1, int(f.width * k)), args.height), Image.NEAREST)
                  for f in frames]

    os.makedirs(OUT_DIR, exist_ok=True)
    names = []
    for i, f in enumerate(frames):
        n = args.name if len(frames) == 1 else "%s%d" % (args.name, i + 1)
        f.save(os.path.join(OUT_DIR, n + ".png"))
        names.append(n)
        print("  저장 %s.png  %dx%d" % (n, f.width, f.height))

    c = cap_width(frames[0])
    kv = (c / IDLE_CAP) if c else 1.0
    if not c:
        print("\n  학사모를 못 찾았습니다. k 는 눈으로 맞추세요 (크면 키우고 작으면 줄입니다).")

    print("\npet.js 의 SPRITES 에 붙이세요 :")
    for n, f in zip(names, frames):
        print('  %-7s { src: "sprites/%s.png", w: %d, h: %d, k: %.2f },'
              % (n + ":", n, f.width, f.height, kv))
    if len(names) > 1:
        print('\n걷기라면:  const WALK = { frames: %s, fps: 8 };'
              % str(names).replace("'", '"'))


if __name__ == "__main__":
    main()
