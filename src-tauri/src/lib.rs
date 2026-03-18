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
) -> Vec<String> {
    // захват уже в нужной пропорции, поэтому просто масштабируем в целевой размер
    let vf = format!(
        "scale={w}:{h}",
        w = output_width,
        h = output_height,
    );

    let mut args: Vec<String> = vec![
        "-y".into(),
        "-f".into(), "rawvideo".into(),
        "-pix_fmt".into(), "rgba".into(),
        "-s".into(), capture_size.into(),
        "-framerate".into(), fps.into(),
        "-i".into(), frames_path.into(),
        "-i".into(), audio_path.into(),
        "-c:v".into(), encoder.into(),
        "-vf".into(), vf,
    ];

    // preset имеет смысл только для софтового libx264
    if encoder == "libx264" {
        args.push("-preset".into());
        args.push("fast".into());
    }

    args.extend([
        "-b:v".into(), "8M".into(),
        "-pix_fmt".into(), "yuv420p".into(),
        "-c:a".into(), "aac".into(),
        "-b:a".into(), "192k".into(),
        "-shortest".into(),
        "-movflags".into(), "+faststart".into(),
        output_path.into(),
    ]);

    args
}

// создаёт пустой временный .rgba файл, возвращает абсолютный путь
#[tauri::command]
async fn begin_frame_stream(width: u32, height: u32, fps: u32) -> Result<String, String> {
    let _ = (width, height, fps);
    let tmp_dir = std::env::temp_dir();

    // чистим хвосты от прошлых сессий
    cleanup_stale_frame_files(&tmp_dir);

    let pid = std::process::id();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let path = tmp_dir.join(format!("mvapp_frames_{}_{}.rgba", pid, nanos));

    std::fs::File::create(&path)
        .map_err(|e| format!("не удалось создать временный файл кадров: {}", e))?;

    let path_str = path.to_string_lossy().to_string();
    println!("[begin_frame_stream] {}x{}@{} -> {}", width, height, fps, path_str);
    Ok(path_str)
}

// удаляет файл кадров (вызывается при отмене/ошибке)
#[tauri::command]
fn cancel_frame_stream(frame_file_path: String) -> Result<(), String> {
    let _ = std::fs::remove_file(&frame_file_path);
    println!("[cancel_frame_stream] удалён {}", frame_file_path);
    Ok(())
}

// пишет аудио во временный файл, запускает ffmpeg с аппаратным энкодером
// (fallback на libx264), чистит временные файлы через Drop-гарды
#[tauri::command]
async fn finalize_video(
    app: tauri::AppHandle,
    frame_file_path: String,
    capture_width: u32,
    capture_height: u32,
    output_width: u32,
    output_height: u32,
    fps: u32,
    audio_bytes: Vec<u8>,
    audio_extension: String,
    output_path: String,
) -> Result<(), String> {
    // гард на файл кадров живёт до конца функции
    let _frames_guard = TempFileGuard {
        path: std::path::PathBuf::from(&frame_file_path),
    };

    let tmp_dir = std::env::temp_dir();
    let pid = std::process::id();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
}
