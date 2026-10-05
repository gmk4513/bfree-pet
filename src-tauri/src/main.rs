// 윈도우에서 콘솔 검은 창이 같이 뜨지 않게 합니다. 릴리스 빌드에만 걸립니다.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, PhysicalSize,
};

/// 펫을 끕니다. 창에 X 버튼이 없으므로(테두리를 없앴습니다)
/// 트레이 메뉴나 캐릭터 오른쪽 버튼으로 여기까지 옵니다.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// 수동 / 자동을 바꿀 때 창이 키보드를 받을 수 있는지를 함께 바꿉니다.
///
/// 자동일 때는 아예 '포커스를 못 받는 창'으로 만듭니다. 윈도우에서는
/// WS_EX_NOACTIVATE 가 걸립니다. 그래야 펫을 띄워 둔 채로 다른 일을 할 때
/// 이 창이 키보드를 가로채는 일이 없습니다. 화면 쪽에서 키를 무시하는
/// 것만으로는 부족합니다 — 창이 포커스를 쥐고 있으면 그 키는 원래 쓰려던
/// 프로그램에도 안 갑니다. 그냥 사라집니다.
///
/// 수동일 때는 반대로 포커스를 받을 수 있게 열고 바로 가져옵니다.
#[tauri::command]
fn set_manual(app: tauri::AppHandle, on: bool) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_focusable(on);
        if on {
            let _ = w.set_focus();
        }
    }
}

/* ---------- 맥 전용 ----------
   창을 독 위로 올립니다.

   Tauri 의 alwaysOnTop 은 맥에서 NSFloatingWindowLevel(3) 입니다.
   그런데 독은 레벨 20, 메뉴 막대는 24 입니다. 그래서 그냥 두면 펫이
   독 뒤로 숨어 다리가 잘립니다 — 깃허브 맥에서 띄워 찍어 확인했습니다.
   윈도우에서는 작업표시줄이 보통 창이라 이런 일이 없습니다.

   21 로 둡니다. 독(20)보다는 위, 메뉴 막대(24)보다는 아래입니다.
   메뉴 막대까지 덮으면 그게 더 거슬립니다.                           */
#[cfg(target_os = "macos")]
const ABOVE_DOCK: isize = 21;

#[cfg(target_os = "macos")]
fn raise_above_dock(win: &tauri::WebviewWindow) {
    use objc2::{msg_send, runtime::AnyObject};
    if let Ok(ptr) = win.ns_window() {
        unsafe {
            let ns = ptr as *mut AnyObject;
            let _: () = msg_send![ns, setLevel: ABOVE_DOCK];
        }
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![quit_app, set_manual])
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

            // 시작은 자동입니다. 포커스를 못 받는 창으로 열어 둡니다.
            let _ = win.set_focusable(false);

            /* 맥에서는 독 위로 올리고, 메뉴 막대와 독 아이콘에서 뺍니다.
               바탕화면에 사는 물건이라 메뉴 막대를 차지할 이유가 없습니다.
               조작은 트레이와 창 안 조작판으로 다 됩니다.             */
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                raise_above_dock(&win);

                // tao 가 alwaysOnTop 레벨을 메인 큐에 비동기로 겁니다.
                // 여기서 한 번만 올려 두면 그쪽이 나중에 덮어씁니다.
                let h = app.handle().clone();
                std::thread::spawn(move || {
                    for _ in 0..6 {
                        std::thread::sleep(std::time::Duration::from_millis(300));
                        let hh = h.clone();
                        let _ = h.run_on_main_thread(move || {
                            if let Some(w) = hh.get_webview_window("main") {
                                raise_above_dock(&w);
                            }
                        });
                    }
                });
            }

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
                    // 소환과 포즈는 창 안 조작판으로 옮겼습니다. 트레이 메뉴는
                    // 한 번 고르면 닫혀서, 적을 둘 이상 부르려면 매번 다시
                    // 열어야 했습니다. 여기는 조작판을 여닫는 길만 둡니다.
                    &item("panel:toggle", "조작판 보이기 / 숨기기")?,
                    &item("mode:manual", "수동 조작 켜기 / 끄기")?,
                    &PredefinedMenuItem::separator(app)?,
                    &item("app:quit", "끝내기")?,
                ],
            )?;

            let handle = app.handle().clone();
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("학사모 비프리 데스크톱 펫")
                .menu(&menu)
                .show_menu_on_left_click(true)
                // 트레이를 눌러 메뉴가 열렸다고 화면에 알립니다. 수동일 때
                // 창이 포커스를 도로 뺏어 오는데, 그때 메뉴가 닫혀 버리면
                // 수동을 끌 방법이 없어집니다. 화면은 이 신호를 받고 잠깐
                // 포커스를 안 가져갑니다.
                .on_tray_icon_event(|tray, ev| {
                    if let TrayIconEvent::Click { .. } = ev {
                        let _ = tray.app_handle().emit("trayopen", ());
                    }
                })
                .on_menu_event(move |app, ev| {
                    let id = ev.id().as_ref().to_string();
                    if id == "app:quit" {
                        app.exit(0);
                        return;
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
