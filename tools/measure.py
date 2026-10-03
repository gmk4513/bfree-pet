# 새 스프라이트의 k 값(캐릭터가 그려진 배율)을 재 줍니다.
#   python tools/measure.py ui/sprites/walk1.png
# 나온 값을 pet.js 의 SPRITES 에 k 로 적으세요.
import sys
import numpy as np
from PIL import Image

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


IDLE_CAP = 99.0          # idle.png 의 학사모 폭. 모든 비교의 기준

def cap_width(path):
    a = np.asarray(Image.open(path).convert('RGBA')).astype(int)
    al, r, g, b = a[..., 3], a[..., 0], a[..., 1], a[..., 2]
    dark = (al > 120) & (r < 80) & (g < 80) & (b < 80)
    ys = np.nonzero(al.max(axis=1) > 12)[0]
    top, bot = ys.min(), ys.max()
    band = dark[top:top + int((bot - top) * 0.34)]
    w = [np.nonzero(row)[0].max() - np.nonzero(row)[0].min() + 1
         for row in band if np.count_nonzero(row) > 3]
    return max(w) if w else 0

for p in sys.argv[1:]:
    im = Image.open(p)
    c = cap_width(p)
    if not c:
        print('%s  학사모를 못 찾았습니다. k 는 손으로 정하세요.' % p)
        continue
    print('%s  w:%d h:%d  모자폭 %d  ->  k: %.2f' % (p, im.width, im.height, c, c / IDLE_CAP))
