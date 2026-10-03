"""AI 가 만들어 준 스프라이트 시트를 프레임 낱장으로 자릅니다.

    python tools/cut_sheet.py "비프리_걷기.png" walk
    python tools/cut_sheet.py "로보트_공격모션.png" rb_atk --min-h 300

하는 일
  1. 배경을 지웁니다. 받은 그림은 RGBA 지만 배경이 투명이 아니라 연회색으로
     칠해져 있습니다. 색으로 한 번에 지우면 흰 러닝셔츠와 신발까지 날아가므로,
     ★ 테두리에서 안쪽으로 번져 들어가는 방식(flood fill)을 씁니다.
     캐릭터는 검은 외곽선으로 둘러싸여 있어 거기서 멈춥니다.
  2. 남은 덩어리를 찾아 인물만 고릅니다. 시트에 박힌 글자("Step 1",
     "CHARACTER WALK MOTION SPRITES")는 작고 납작해서 크기로 걸러집니다.
  3. 왼쪽 위부터 읽는 순서로 번호를 매깁니다.
  4. ★ 모든 프레임을 같은 크기 캔버스에 올리고 발바닥을 맞춥니다.
     낱장마다 꽉 맞게 자르면 프레임이 바뀔 때 캐릭터가 튑니다.

결과는 ui/sprites/<이름>1.png ... 로 저장되고,
pet.js 에 붙일 줄까지 찍어 줍니다.
"""

import argparse
import os
import sys
import io

import numpy as np
from PIL import Image
from scipy import ndimage

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

OUT_DIR = os.path.join("ui", "sprites")
IDLE_CAP = 99.0          # idle.png 의 학사모 폭. k 의 기준


def strip_background(im, tol=26, passes=4):
    """테두리에서 번져 들어가며 배경만 지웁니다.

    색으로 한 번에 지우지 않는 이유: 배경이 연회색(#CDCEC7)이라 흰 러닝셔츠,
    흰 신발, 로봇의 밝은 장갑과 거의 같습니다. 전역으로 지우면 캐릭터에
    구멍이 뚫립니다. 바깥에서 번져 들어가면 검은 외곽선에서 멈춥니다.

    여러 번 도는 이유: 어떤 시트는 흰 둥근 액자 안에 회색 바탕이 들어 있습니다.
    한 번만 돌면 액자만 지우고 멈춥니다. 그래서 지운 뒤 새로 드러난
    가장자리 색을 다시 재서 또 번집니다.
    """
    a = np.asarray(im.convert("RGBA")).astype(int)
    rgb = a[..., :3]
    alpha = a[..., 3].copy()

    for p in range(passes):
        live = alpha > 0
        if not live.any():
            break
        # 지금 남아 있는 영역의 바깥 테두리 색을 잰다
        border = live & ~ndimage.binary_erosion(live, iterations=1, border_value=0)
        cols = rgb[border]
        if not len(cols):
            break
        bg = np.median(cols, axis=0)

        # ★ 어두운 색은 배경으로 보지 않는다.
        #   이 시트들의 배경은 항상 밝은 회색이다. 그런데 그림자나 흙을
        #   지우고 나면 다음 바퀴에서 '검정'이 테두리 색으로 잡혀, 학사모와
        #   검은 바지까지 지워 버린다. 실제로 벽돌쌓기 시트에서 겪었다.
        if bg.mean() < 150:
            break

        near = live & (np.abs(rgb - bg).max(axis=2) <= tol)
        lab, n = ndimage.label(near)
        if n == 0:
            break
        # 바깥(투명 또는 이미지 테두리)에 닿은 덩어리만 배경
        touch = set()
        edge_pad = np.pad(~live, 1, constant_values=True)
        lab_pad = np.pad(lab, 1, constant_values=0)
        grow = ndimage.binary_dilation(edge_pad, iterations=1)
        touch |= set(np.unique(lab_pad[grow]))
        touch.discard(0)
        if not touch:
            break
        bgmask = np.isin(lab, list(touch))
        removed = bgmask.sum() / bgmask.size
        alpha = np.where(bgmask, 0, alpha)
        print("  %d차: 배경색 %s, %.0f%% 제거" % (p + 1, bg.astype(int), removed * 100))
        if removed < 0.005:
            break

    out = a.copy()
    out[..., 3] = alpha
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def find_figures(im, min_h, min_area):
    """인물 덩어리만 찾습니다. 글자는 납작하고 작아서 걸러집니다."""
    al = np.asarray(im)[..., 3]
    lab, n = ndimage.label(al > 40)
    boxes = ndimage.find_objects(lab)
    figs = []
    for i, sl in enumerate(boxes, start=1):
        if sl is None:
            continue
        ys, xs = sl
        h, w = ys.stop - ys.start, xs.stop - xs.start
        area = int((lab[sl] == i).sum())
        if h < min_h or area < min_area:
            continue
        figs.append({"box": (xs.start, ys.start, xs.stop, ys.stop), "id": i})

    # 읽는 순서로: 줄을 먼저 묶고, 줄 안에서 왼쪽부터
    if figs:
        hs = [f["box"][3] - f["box"][1] for f in figs]
        band = int(np.median(hs) * 0.55)
        figs.sort(key=lambda f: (round(f["box"][1] / band), f["box"][0]))
    return figs, lab


def head_center(sub):
    """학사모 가로 중심. 소품(벽돌 더미 같은 것)이 늘어나도 안 움직입니다.

    벽돌쌓기처럼 옆에 물건이 쌓이는 동작은 전체 덩어리의 중심으로 맞추면
    캐릭터가 28px 씩 좌우로 흔들립니다. 그때 이 기준을 씁니다.
    """
    a = sub.astype(int)
    al, r, g, b = a[..., 3], a[..., 0], a[..., 1], a[..., 2]
    dark = (al > 120) & (r < 85) & (g < 85) & (b < 85)
    ys = np.nonzero((al > 40).any(axis=1))[0]
    if not len(ys):
        return sub.shape[1] / 2
    band = dark[ys.min(): ys.min() + max(1, int((ys.max() - ys.min()) * 0.30))]
    cols = np.nonzero(band.any(axis=0))[0]
    return (cols.min() + cols.max()) / 2 if len(cols) else sub.shape[1] / 2


def foot_center(mask):
    """발바닥 쪽 가로 중심. 팔을 뻗어도 흔들리지 않는 기준점입니다."""
    ys = np.nonzero(mask.any(axis=1))[0]
    if not len(ys):
        return mask.shape[1] / 2
    lo = ys.max() - max(1, int((ys.max() - ys.min()) * 0.18))
    sub = mask[lo:, :]
    xs = np.nonzero(sub.any(axis=0))[0]
    return (xs.min() + xs.max()) / 2 if len(xs) else mask.shape[1] / 2


def cap_width(im):
    a = np.asarray(im).astype(int)
    al, r, g, b = a[..., 3], a[..., 0], a[..., 1], a[..., 2]
    dark = (al > 120) & (r < 85) & (g < 85) & (b < 85)
    ys = np.nonzero(al.max(axis=1) > 12)[0]
    if not len(ys):
        return 0
    band = dark[ys.min(): ys.min() + max(1, int((ys.max() - ys.min()) * 0.34))]
    w = [np.nonzero(row)[0].max() - np.nonzero(row)[0].min() + 1
         for row in band if np.count_nonzero(row) > 3]
    return max(w) if w else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("name")
    ap.add_argument("--min-h", type=int, default=120, help="이보다 낮은 덩어리는 글자로 봅니다")
    ap.add_argument("--min-area", type=int, default=3000)
    ap.add_argument("--only", default="", help="쓸 프레임 번호. 예: 1,2,3,4")
    ap.add_argument("--flip", action="store_true", help="좌우를 뒤집어 저장합니다")
    ap.add_argument("--height", type=int, default=0, help="세로 몇 px 로 줄일지")
    ap.add_argument("--anchor", choices=["foot", "head"], default="foot",
                    help="가로 기준점. 소품이 늘어나는 동작은 head 를 쓰세요")
    ap.add_argument("--dry", action="store_true", help="저장하지 않고 찾은 것만 보여 줍니다")
    args = ap.parse_args()

    im = strip_background(Image.open(args.src))
    figs, lab = find_figures(im, args.min_h, args.min_area)
    print("  인물 덩어리 %d개" % len(figs))

    keep = [int(x) for x in args.only.split(",") if x.strip()] if args.only else None
    chosen = []
    for i, f in enumerate(figs, start=1):
        x0, y0, x1, y1 = f["box"]
        mark = ""
        if keep and i not in keep:
            mark = "   (건너뜀)"
        else:
            chosen.append(f)
        print("    %2d. x %4d~%-4d y %4d~%-4d  %3dx%-3d%s"
              % (i, x0, x1, y0, y1, x1 - x0, y1 - y0, mark))

    if args.dry or not chosen:
        return

    # 각 프레임을 자르되, 그 덩어리만 남긴다(옆 프레임이 걸쳐 들어오지 않게)
    arr = np.asarray(im)
    cuts = []
    for f in chosen:
        x0, y0, x1, y1 = f["box"]
        sub = arr[y0:y1, x0:x1].copy()
        sub[..., 3] = np.where(lab[y0:y1, x0:x1] == f["id"], sub[..., 3], 0)
        cuts.append(sub)

    # 공통 캔버스: 발바닥을 바닥에, 발 중심을 가로 가운데에
    def anchor_x(sub):
        return head_center(sub) if args.anchor == "head" else foot_center(sub[..., 3] > 40)

    ws, hs, lefts, rights = [], [], [], []
    for sub in cuts:
        m = sub[..., 3] > 40
        c = anchor_x(sub)
        xs = np.nonzero(m.any(axis=0))[0]
        lefts.append(c - xs.min())
        rights.append(xs.max() - c)
        hs.append(sub.shape[0])
    CW = int(max(lefts) + max(rights)) + 4
    CH = int(max(hs)) + 2
    anchor = int(max(lefts)) + 2

    os.makedirs(OUT_DIR, exist_ok=True)
    names, out_imgs = [], []
    for i, sub in enumerate(cuts, start=1):
        canvas = np.zeros((CH, CW, 4), dtype=np.uint8)
        c = int(round(anchor_x(sub)))
        ox = anchor - c
        oy = CH - sub.shape[0] - 1
        canvas[oy:oy + sub.shape[0], ox:ox + sub.shape[1]] = sub
        out = Image.fromarray(canvas, "RGBA")
        if args.flip:
            out = out.transpose(Image.FLIP_LEFT_RIGHT)
        if args.height:
            k = args.height / out.height
            out = out.resize((max(1, int(out.width * k)), args.height), Image.NEAREST)
        n = "%s%d" % (args.name, i) if len(cuts) > 1 else args.name
        out.save(os.path.join(OUT_DIR, n + ".png"))
        names.append(n)
        out_imgs.append(out)
        print("  저장 %s.png  %dx%d" % (n, out.width, out.height))

    c = cap_width(out_imgs[0])
    kv = (c / IDLE_CAP) if c else 0
    print("\npet.js 의 SPRITES 에 붙이세요:")
    for n, o in zip(names, out_imgs):
        if kv:
            print('  %-9s { src: "sprites/%s.png", w: %d, h: %d, k: %.2f },'
                  % (n + ":", n, o.width, o.height, kv))
        else:
            print('  %-9s { src: "sprites/%s.png", w: %d, h: %d, k: ?? },   학사모 못 찾음'
                  % (n + ":", n, o.width, o.height))
    if len(names) > 1:
        print('\n  frames: %s' % str(names).replace("'", '"'))


if __name__ == "__main__":
    main()
