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

/* 바닥 높이를 운영체제한테 물어봅니다.

   캐릭터는 작업표시줄(윈도우) / 독(맥) 바로 위에 서야 합니다. 그런데 그
   높이는 사람마다 다릅니다 — 작업표시줄을 크게 쓰는 사람, 독을 키운 사람,
   자동 숨김으로 둔 사람, 옆에 붙여 둔 사람. 48px 로 박아 두면 누군가는
   발이 잠기고 누군가는 공중에 뜹니다. 실제로 맥에서 발이 독에 잠겼습니다.

   work_area 는 '작업표시줄을 뺀 쓸 수 있는 영역'이라, 화면 아래쪽과의
   차이가 곧 작업표시줄 높이입니다. 운영체제가 직접 알려주는 값입니다.   */
#[tauri::command]
fn floor_offset(app: tauri::AppHandle) -> f64 {
    let Some(win) = app.get_webview_window("main") else {
        return -1.0;
    };
    let Ok(Some(mon)) = win.current_monitor() else {
        return -1.0;
    };
    let work = mon.work_area();
    let scale = mon.scale_factor().max(0.1);

    let screen_bottom = mon.position().y + mon.size().height as i32;
    let work_bottom = work.position.y + work.size.height as i32;
    let gap = (screen_bottom - work_bottom) as f64 / scale;

    // 말이 안 되는 값이면 화면 쪽에서 설정값을 쓰게 -1 을 돌려줍니다
    if (0.0..=400.0).contains(&gap) {
        gap
    } else {
        -1.0
    }
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
    // AppKit 은 메인 스레드에서만 만집니다. 명령은 다른 스레드에서 올 수 있습니다.
    #[cfg(target_os = "macos")]
    {
        let _ = app.run_on_main_thread(move || app_activate(on));
    }

    /* 맥에서는 한 번 불러서 포커스를 못 잡는 경우가 있습니다. 특히 자동으로
       내려놓았다가 다시 켤 때 그렇습니다 — 창을 '포커스 못 받는 창'으로
       돌려놨다가 되살리는 길이라 한 틱에 안 먹습니다. 실제로 깃허브 맥에서
       재 보니 두 번째로 켤 때 창이 키보드를 못 쥐었습니다.
       그래서 잡을 때까지 몇 번 더 두드립니다.                             */
    #[cfg(target_os = "macos")]
    if on {
        let app2 = app.clone();
        std::thread::spawn(move || {
            for _ in 0..6 {
                std::thread::sleep(std::time::Duration::from_millis(120));
                let got = app2
                    .get_webview_window("main")
                    .and_then(|w| w.is_focused().ok())
                    .unwrap_or(false);
                if got {
                    break;
                }
                if let Some(w) = app2.get_webview_window("main") {
                    let _ = w.set_focusable(true);
                    let _ = w.set_focus();
                }
                let _ = app2.run_on_main_thread(|| app_activate(true));
            }
        });
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

/* 앱 자체를 켜고 끕니다.

   set_focusable(false) 는 '앞으로 포커스를 새로 받지 말라'는 설정이지,
   '지금 쥔 포커스를 뱉으라'는 뜻이 아닙니다. 수동에서 자동으로 넘어가는
   순간 창은 이미 포커스를 쥐고 있어서, 맥에서는 그대로 쥔 채 남습니다.
   그러면 자동인데도 키가 캐릭터한테도 안 가고 쓰던 프로그램한테도 안 가고
   그냥 사라집니다.

   윈도우에서는 자동으로 갈 때 클릭 통과도 같이 켜지니까, 아무 데나 한 번
   누르는 순간 저쪽이 포커스를 가져가 저절로 정리됩니다. 맥에서도 같은 일이
   클릭 없이 바로 일어나게 NSApp 에 직접 말합니다.

   켤 때 activate 가 필요한 이유는 Accessory 앱이라서입니다. 독에도 메뉴
   막대에도 없는 앱은 창을 띄워도 키 윈도우가 안 되는 경우가 있습니다.   */
#[cfg(target_os = "macos")]
fn app_activate(on: bool) {
    use objc2::{class, msg_send, runtime::AnyObject};
    unsafe {
        let ns_app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
        if ns_app.is_null() {
            return;
        }
        if on {
            let _: () = msg_send![ns_app, activateIgnoringOtherApps: true];
        } else {
            let _: () = msg_send![ns_app, deactivate];
        }
    }
}

/// 앱이 지금 활성 상태인지. 자가 점검에서 씁니다.
#[cfg(target_os = "macos")]
fn ns_app_is_active() -> bool {
    use objc2::{class, msg_send, runtime::AnyObject};
    unsafe {
        let ns_app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
        if ns_app.is_null() {
            return false;
        }
        let active: bool = msg_send![ns_app, isActive];
        active
    }
}

/* 자가 점검.  --selftest 를 붙여 띄우면 혼자 모드를 오가며 그때마다
   '창이 키보드를 쥐고 있는지'를 적어 둡니다. 맥이 없어서 손으로 못
   눌러 보니, 적어도 포커스가 의도대로 오가는지는 기계가 재게 합니다.

   마지막에 수동으로 켜 둔 채 멈춥니다. 그래야 그다음에 바깥에서
   키를 눌러 보는 시험을 이어서 할 수 있습니다.                      */
#[cfg(target_os = "macos")]
fn selftest(app: tauri::AppHandle) {
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    let log: Arc<Mutex<String>> = Arc::new(Mutex::new(String::from(
        "단계	창이 포커스를 쥐었나	앱이 활성인가
",
    )));

    let snap = |label: &str, app: &tauri::AppHandle, log: &Arc<Mutex<String>>| {
        let l = log.clone();
        let a = app.clone();
        let label = label.to_string();
        let _ = app.run_on_main_thread(move || {
            let focused = a
                .get_webview_window("main")
                .and_then(|w| w.is_focused().ok())
                .unwrap_or(false);
            let active = ns_app_is_active();
            if let Ok(mut s) = l.lock() {
                s.push_str(&format!("{}	{}	{}
", label, focused, active));
            }
        });
        std::thread::sleep(Duration::from_millis(800));
    };

    /* 트레이 메뉴를 누른 것과 똑같은 길로 보냅니다.
       set_manual 을 바로 부르면 창 설정만 바뀌고 화면(JS)은 여전히 자동이라,
       정작 키를 받는 쪽은 꺼진 채로 재게 됩니다. 실제로 그렇게 재서
       조작판 버튼이 켜지지도 않은 화면을 찍었습니다.                      */
    let toggle = |app: &tauri::AppHandle| {
        let _ = app.emit("menu", "mode:manual");
    };

    std::thread::sleep(Duration::from_secs(8)); // 창이 다 뜰 때까지
    snap("1_시작_자동", &app, &log);

    toggle(&app);
    std::thread::sleep(Duration::from_secs(3));
    snap("2_수동_켬", &app, &log);

    toggle(&app);
    std::thread::sleep(Duration::from_secs(3));
    snap("3_자동_복귀", &app, &log);

    // 바깥에서 키를 눌러 볼 수 있게 수동으로 켜 두고 멈춥니다
    toggle(&app);
    std::thread::sleep(Duration::from_secs(3));
    snap("4_수동_유지", &app, &log);

    let path = std::path::PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| ".".into()))
        .join("bfree-selftest.log");
    let text = log.lock().map(|s| s.clone()).unwrap_or_default();
    let _ = std::fs::write(path, text);
}

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
        .invoke_handler(tauri::generate_handler![quit_app, set_manual, floor_offset])
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
                // --selftest 로 띄우면 혼자 모드를 오가며 기록합니다
                if std::env::args().any(|a| a == "--selftest") {
                    let h = app.handle().clone();
                    std::thread::spawn(move || selftest(h));
                }

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
