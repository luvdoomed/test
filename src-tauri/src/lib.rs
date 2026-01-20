use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// гарантированно удаляет временный файл при выходе из области видимости
struct TempFileGuard {
    path: std::path::PathBuf,
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        match std::fs::remove_file(&self.path) {
            Ok(()) => eprintln!("[cleanup] удалён {}", self.path.display()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => eprintln!(
                "[cleanup] не удалось удалить {}: {}",
                self.path.display(),
                e
            ),
        }
    }
}

// сносит старые файлы кадров от прошлых прерванных сессий
fn cleanup_stale_frame_files(tmp_dir: &std::path::Path) {
    let now = std::time::SystemTime::now();
    let one_hour = std::time::Duration::from_secs(3600);

    let entries = match std::fs::read_dir(tmp_dir) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("[cleanup] не удалось открыть {}: {}", tmp_dir.display(), e);
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        if !name.starts_with("mvapp_frames_") || !name.ends_with(".rgba") {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let modified = match meta.modified() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if let Ok(age) = now.duration_since(modified) {
            if age >= one_hour {
                match std::fs::remove_file(&path) {
                    Ok(()) => eprintln!(
                        "[cleanup] удалён устаревший {} (возраст {} сек)",
                        path.display(),
                        age.as_secs()
                    ),
                    Err(e) => eprintln!(
                        "[cleanup] не удалось удалить устаревший {}: {}",
                        path.display(),
                        e
                    ),
                }
            }
        }
    }
}

// выбирает аппаратный h264 энкодер для платформы
fn primary_encoder() -> &'static str {
    if cfg!(target_os = "macos") {
        "h264_videotoolbox"
    } else if cfg!(target_os = "windows") {
        "h264_nvenc"
    } else {
        "libx264"
    }
}

fn build_ffmpeg_args(
    encoder: &str,
    capture_size: &str,
    output_width: u32,
    output_height: u32,
    fps: &str,
    frames_path: &str,
    audio_path: &str,
    output_path: &str,
)
