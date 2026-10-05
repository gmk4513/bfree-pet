//  맥에서 '누가 누구 위에 있는지'를 숫자로 뽑습니다.
//
//  CGWindowListCopyWindowInfo 는 화면에 떠 있는 모든 창의 레벨과 크기를
//  돌려줍니다. 창 '이름'만 화면 녹화 권한이 필요하고, 주인 이름 · 레벨 ·
//  위치는 권한 없이 읽힙니다. CI 에서 스크린샷이 막혀도 이건 나옵니다.
//
//  레벨이 클수록 위에 그려집니다. 우리가 보려는 것:
//    - 우리 앱(Bfree Pet)의 레벨
//    - Dock 의 레벨
//  우리 쪽이 더 낮으면 캐릭터가 독 뒤로 숨습니다.

import CoreGraphics
import Foundation

let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []

struct Row { let owner: String; let layer: Int; let alpha: Double
             let x: Double; let y: Double; let w: Double; let h: Double }

var rows: [Row] = []
for win in list {
    let owner = win[kCGWindowOwnerName as String] as? String ?? "?"
    let layer = win[kCGWindowLayer as String] as? Int ?? -9999
    let alpha = win[kCGWindowAlpha as String] as? Double ?? -1
    let b = win[kCGWindowBounds as String] as? [String: Any] ?? [:]
    rows.append(Row(owner: owner, layer: layer, alpha: alpha,
                    x: b["X"] as? Double ?? 0, y: b["Y"] as? Double ?? 0,
                    w: b["Width"] as? Double ?? 0, h: b["Height"] as? Double ?? 0))
}
rows.sort { $0.layer > $1.layer }

var out = "화면에 떠 있는 창 (레벨 큰 것이 위)\n"
out += "레벨   투명도   크기            위치           주인\n"
for r in rows {
    out += String(format: "%5d  %6.2f  %5.0f x %-5.0f  %5.0f,%-5.0f  %@\n",
                  r.layer, r.alpha, r.w, r.h, r.x, r.y, r.owner)
}

let pet  = rows.first { $0.owner.contains("Bfree") || $0.owner.contains("비프리") }
let dock = rows.first { $0.owner == "Dock" }

out += "\n--- 판정 ---\n"
switch (pet, dock) {
case let (p?, d?):
    out += "펫  레벨 \(p.layer)   (\(Int(p.w))x\(Int(p.h)) @ \(Int(p.x)),\(Int(p.y)))\n"
    out += "독  레벨 \(d.layer)   (\(Int(d.w))x\(Int(d.h)) @ \(Int(d.x)),\(Int(d.y)))\n"
    out += p.layer > d.layer
        ? "=> 펫이 독보다 위입니다. 작업표시줄(독) 위로 걸어다닙니다.\n"
        : "=> 펫이 독보다 아래입니다. 독에 가립니다. 창 레벨을 올려야 합니다.\n"
case (nil, _):
    out += "펫 창을 못 찾았습니다. 앱이 안 떴거나 창이 화면에 없습니다.\n"
case (_, nil):
    out += "독 창을 못 찾았습니다. 러너에서 독이 숨어 있을 수 있습니다.\n"
}

print(out)
try? out.write(toFile: "windows.txt", atomically: true, encoding: .utf8)
