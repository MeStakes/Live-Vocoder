// Live Vocoder: app Mac per Keopees (spec docs/superpowers/specs/2026-10-11-live-vocoder-v1-design.md).
mod audio;
mod camera;
mod canzoni;
mod dispositivi;
mod registrazioni;
mod suono;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(audio::Audio::default())
        .manage(registrazioni::Reg::default())
        .invoke_handler(tauri::generate_handler![
            audio::avvia_audio, audio::ferma_audio, audio::set, audio::set_note,
            dispositivi::dispositivi,
            camera::camere, camera::prefer_camera,
            canzoni::leggi_canzoni, canzoni::scrivi_canzoni, canzoni::metti_da_parte_canzoni,
            registrazioni::apri_registrazione, registrazioni::aggiungi_pezzo, registrazioni::chiudi_registrazione,
            registrazioni::spazio_libero, registrazioni::guarda, registrazioni::mostra, registrazioni::butta,
            registrazioni::scegli_cartella, registrazioni::cartella_predefinita,
        ])
        .run(tauri::generate_context!())
        .expect("avvio di Live Vocoder");
}
