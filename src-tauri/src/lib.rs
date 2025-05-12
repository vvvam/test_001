// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[cfg(mobile)]
mod mobile;
#[cfg(mobile)]
pub use mobile::*;

pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
