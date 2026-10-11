// Live Vocoder: app Mac per Keopees (spec docs/superpowers/specs/2026-10-11-live-vocoder-v1-design.md).
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("avvio di Live Vocoder");
}
