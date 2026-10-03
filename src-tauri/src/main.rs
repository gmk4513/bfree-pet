// 윈도우에서 콘솔 검은 창이 같이 뜨지 않게 합니다. 릴리스 빌드에만 걸립니다.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, PhysicalPosition, PhysicalSize,
};

/// 펫을 끕니다. 창에 X 버튼이 없으므로(테두리를 없앴습니다)
/// 트레이 메뉴나 캐릭터 오른쪽 버튼으로 여기까지 옵니다.
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

            /* ---------- 트레이 메뉴 ----------
               창에는 버튼을 둘 자리가 없습니다. 투명한 판이라 UI 를 띄우면
               바탕화면을 가립니다. 그래서 조작은 전부 트레이로 뺍니다.

               메뉴 항목의 id 를 그대로 "menu" 이벤트로 화면에 보냅니다.
               Rust 는 무슨 뜻인지 모르고, 해석은 pet.js 가 합니다.
               동작을 추가할 때 Rust 를 안 고치려고 이렇게 둡니다.         */
            let item = |id: &str, label: &str| -> tauri::Result<MenuItem<tauri::Wry>> {
                MenuItem::with_id(app, id, label, true, None::<&str>)
            };

            let menu = Menu::with_items(
                app,
                &[
                    &item("spawn:robot", "로보트 소환")?,
                    &item("spawn:g1", "60대 할배1 소환")?,
                    &item("spawn:g2", "60대 할배2 소환")?,
                    &PredefinedMenuItem::separator(app)?,
                    &item("pose:lift", "운동")?,
                    &item("pose:rap", "공연")?,
                    &item("pose:rapwalk", "프리스타일")?,
                    &item("pose:brick", "노가다")?,
                    &item("pose:flex", "근육 자랑")?,
                    &PredefinedMenuItem::separator(app)?,
                    &item("mode:manual", "수동 조작 켜기 / 끄기")?,
                    &PredefinedMenuItem::separator(app)?,
                    &item("app:quit", "끝내기")?,
                ],
            )?;

            let handle = app.handle().clone();
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("비프리 데스크톱 펫")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app, ev| {
                    let id = ev.id().as_ref().to_string();
                    if id == "app:quit" {
                        app.exit(0);
                        return;
                    }
                    // 수동 조작을 켜려면 창이 키보드를 받아야 합니다.
                    if id == "mode:manual" {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.set_focus();
                        }
                    }
                    let _ = app.emit("menu", id);
                })
                .build(app)?;

            // 커서 위치를 Rust 에서 읽어 화면 쪽으로 보냅니다.
            // 클릭을 통과시키는 동안에는 마우스 이벤트가 웹뷰에 오지 않아서,
            // 커서가 캐릭터 위에 있는지를 화면 혼자서는 알 수 없습니다.
            let handle2 = handle.clone();
            std::thread::spawn(move || loop {
                if let Ok(pos) = handle2.cursor_position() {
                    if let Some(w) = handle2.get_webview_window("main") {
                        // 커서는 바탕화면 기준, 창은 모니터 기준이라 창 위치를 뺍니다.
                        let (ox, oy) = match w.outer_position() {
                            Ok(p) => (p.x as f64, p.y as f64),
                            Err(_) => (0.0, 0.0),
                        };
                        let scale = w.scale_factor().unwrap_or(1.0);
                        let _ = handle2.emit(
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
