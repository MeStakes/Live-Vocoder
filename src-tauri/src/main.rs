// Live Vocoder: app Mac per Keopees (spec docs/superpowers/specs/2026-10-11-live-vocoder-v1-design.md).
mod audio;
mod dispositivi;
mod suono;

fn main() {
    tauri::Builder::default()
        .manage(audio::Audio::default())
        .invoke_handler(tauri::generate_handler![
            audio::avvia_audio, audio::ferma_audio, audio::set, audio::set_note,
            dispositivi::dispositivi,
        ])
        .run(tauri::generate_context!())
        .expect("avvio di Live Vocoder");
}
