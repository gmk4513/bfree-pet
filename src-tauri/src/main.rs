// 윈도우에서 콘솔 검은 창이 같이 뜨지 않게 합니다. 릴리스 빌드에만 걸립니다.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize};

/// 펫을 끕니다. 창에 X 버튼이 없으므로(테두리를 없앴습니다)
/// 캐릭터를 오른쪽 버튼으로 눌러 여기로 들어옵니다.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![quit_app])
        .setup(|app| {
            let win = app.get_webview_window("main").unwrap();

            // 창을 화면 전체에 맞춥니다. 캐릭터는 이 판 위를 걸어 다닙니다.
            if let Ok(Some(mon)) = win.current_monitor() {
                let s: PhysicalSize<u32> = *mon.size();
                let p: PhysicalPosition<i32> = *mon.position();
                let _ = win.set_size(s);
                let _ = win.set_position(p);
            }

            // 기본은 클릭 통과입니다. 이걸 안 켜면 투명한 판이 화면 전체를
            // 덮고 있어서 바탕화면도 다른 창도 누를 수 없게 됩니다.
            let _ = win.set_ignore_cursor_events(true);

            // 커서 위치를 Rust 에서 읽어 화면 쪽으로 보냅니다.
            // 클릭을 통과시키는 동안에는 마우스 이벤트가 웹뷰에 오지 않아서,
            // 커서가 캐릭터 위에 있는지를 화면 혼자서는 알 수 없습니다.
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                if let Ok(pos) = handle.cursor_position() {
                    if let Some(w) = handle.get_webview_window("main") {
                        // 커서는 바탕화면 기준, 창은 모니터 기준이라 창 위치를 뺍니다.
                        let (ox, oy) = match w.outer_position() {
                            Ok(p) => (p.x as f64, p.y as f64),
                            Err(_) => (0.0, 0.0),
                        };
                        let scale = w.scale_factor().unwrap_or(1.0);
                        let _ = handle.emit(
                            "cursor",
                            serde_json::json!({
                                "x": (pos.x - ox) / scale,
                                "y": (pos.y - oy) / scale
                            }),
                        );
                    }
                }
                std::thread::sleep(std::time::Duration::from_millis(60));
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("비프리 펫을 시작하지 못했습니다");
}
