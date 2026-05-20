use std::io::Read;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn diag_log_append(line: String) -> Result<(), String> {
    use std::io::Write;
    let path = "/tmp/mvapp_diag.log";
    let mut f = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("open log: {}", e))?;
    writeln!(f, "{}", line).map_err(|e| format!("write log: {}", e))?;
    Ok(())
}

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

struct TempDirGuard {
    path: std::path::PathBuf,
}

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        match std::fs::remove_dir_all(&self.path) {
            Ok(()) => eprintln!("[cleanup] удалена папка {}", self.path.display()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => eprintln!(
                "[cleanup] не удалось удалить {}: {}",
                self.path.display(),
                e
            ),
        }
    }
}

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
    fps: &str,
    output_width: u32,
    output_height: u32,
    frames_pattern: &str,
    audio_path: &str,
    output_path: &str,
) -> Vec<String> {
    // scale + pad с чёрным к чётным размерам, иначе libx264 ругается на нечёт
    let vf = format!(
        "scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p",
        w = output_width,
        h = output_height,
    );

    let mut args: Vec<String> = vec![
        "-y".into(),
        "-framerate".into(), fps.into(),
        "-i".into(), frames_pattern.into(),
        "-i".into(), audio_path.into(),
        "-c:v".into(), encoder.into(),
        "-vf".into(), vf,
    ];

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

// извлекает png из чанка, нумерует глобально через counter
fn extract_chunk_renamed(
    tar_bytes: &[u8],
    out_dir: &std::path::Path,
    counter: &mut u64,
) -> Result<(), String> {
    let mut archive = tar::Archive::new(tar_bytes);
    let entries = archive
        .entries()
        .map_err(|e| format!("не удалось прочитать tar: {}", e))?;

    for entry in entries {
        let mut entry = entry.map_err(|e| format!("ошибка чтения записи tar: {}", e))?;
        let path = entry
            .path()
            .map_err(|e| format!("ошибка пути tar: {}", e))?
            .into_owned();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if !name.ends_with(".jpg") {
            continue;
        }
        let mut buf = Vec::new();
        entry
            .read_to_end(&mut buf)
            .map_err(|e| format!("чтение содержимого {}: {}", name, e))?;
        let out_name = format!("frame_{:07}.jpg", *counter);
        let out_path = out_dir.join(&out_name);
        std::fs::write(&out_path, &buf)
            .map_err(|e| format!("запись {}: {}", out_path.display(), e))?;
        *counter += 1;
    }

    Ok(())
}

#[tauri::command]
fn prepare_export_dir() -> Result<String, String> {
    let tmp_dir = std::env::temp_dir();
    let pid = std::process::id();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = tmp_dir.join(format!("mvapp_export_{}_{}", pid, ts));
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("не удалось создать папку экспорта: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn cleanup_export_dir(dir: String) -> Result<(), String> {
    let _ = std::fs::remove_dir_all(&dir);
    Ok(())
}

#[tauri::command]
async fn build_video_from_dir(
    app: tauri::AppHandle,
    frames_dir: String,
    width: u32,
    height: u32,
    fps: u32,
    audio_bytes: Vec<u8>,
    audio_extension: String,
    output_path: String,
) -> Result<(), String> {
    let _frames_guard = TempDirGuard { path: std::path::PathBuf::from(&frames_dir) };

    let frames_count = std::fs::read_dir(&frames_dir)
        .map_err(|e| format!("read_dir: {}", e))?
        .filter_map(|e| e.ok())
        .count();
    println!("[build_video_from_dir] dir={} frames={}", frames_dir, frames_count);
    if frames_count == 0 {
        return Err("в папке экспорта нет кадров".into());
    }

    let tmp_dir = std::env::temp_dir();
    let pid = std::process::id();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let ext = if audio_extension.is_empty() { "bin".to_string() } else { audio_extension };
    let audio_path = tmp_dir.join(format!("mvapp_audio_{}_{}.{}", pid, ts, ext));
    std::fs::write(&audio_path, &audio_bytes)
        .map_err(|e| format!("не удалось записать временное аудио: {}", e))?;
    let _audio_guard = TempFileGuard { path: audio_path.clone() };

    let frames_pattern = std::path::PathBuf::from(&frames_dir)
        .join("frame_%07d.jpg")
        .to_string_lossy()
        .to_string();
    let audio_str = audio_path.to_string_lossy().to_string();
    let fps_str = fps.to_string();

    let encoder = primary_encoder();
    println!("[build_video_from_dir] {}x{} @ {} fps, энкодер {}", width, height, fps, encoder);

    let args = build_ffmpeg_args(
        encoder, &fps_str, width, height, &frames_pattern, &audio_str, &output_path,
    );
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let ffmpeg_start = std::time::Instant::now();
    let first = app
        .shell()
        .command("ffmpeg")
        .args(&str_args)
        .output()
        .await
        .map_err(|e| format!("ffmpeg не запустился: {}", e))?;
    println!("[rec-diag-rust] ffmpeg took {:.2}s", ffmpeg_start.elapsed().as_secs_f64());

    if first.status.success() {
        return Ok(());
    }

    let first_stderr = String::from_utf8_lossy(&first.stderr).to_string();
    eprintln!("[build_video_from_dir] {} упал:\n{}", encoder, first_stderr);

    if encoder == "libx264" {
        return Err(format!("ffmpeg завершился с ошибкой:\n{}", first_stderr));
    }

    eprintln!("[build_video_from_dir] пробую libx264");
    let fb_args = build_ffmpeg_args(
        "libx264", &fps_str, width, height, &frames_pattern, &audio_str, &output_path,
    );
    let fb_str_args: Vec<&str> = fb_args.iter().map(|s| s.as_str()).collect();
    let fb_start = std::time::Instant::now();
    let fb = app
        .shell()
        .command("ffmpeg")
        .args(&fb_str_args)
        .output()
        .await
        .map_err(|e| format!("fallback libx264 не запустился: {}", e))?;
    println!("[rec-diag-rust] ffmpeg (libx264 fallback) took {:.2}s", fb_start.elapsed().as_secs_f64());

    if fb.status.success() {
        Ok(())
    } else {
        let fb_stderr = String::from_utf8_lossy(&fb.stderr);
        Err(format!(
            "ffmpeg не справился ни с {}, ни с libx264.\n{} stderr:\n{}\nlibx264 stderr:\n{}",
            encoder, encoder, first_stderr, fb_stderr,
        ))
    }
}

#[tauri::command]
async fn build_video_from_png_tar(
    app: tauri::AppHandle,
    tar_chunks: Vec<Vec<u8>>,
    width: u32,
    height: u32,
    fps: u32,
    audio_bytes: Vec<u8>,
    audio_extension: String,
    output_path: String,
) -> Result<(), String> {
    println!(
        "[rec-diag-rust] tar_chunks count: {}, total bytes: {}",
        tar_chunks.len(),
        tar_chunks.iter().map(|c| c.len()).sum::<usize>(),
    );

    let tmp_dir = std::env::temp_dir();
    let pid = std::process::id();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);

    let frames_dir = tmp_dir.join(format!("mvapp_frames_{}_{}", pid, ts));
    std::fs::create_dir_all(&frames_dir)
        .map_err(|e| format!("не удалось создать папку кадров: {}", e))?;
    let _frames_guard = TempDirGuard { path: frames_dir.clone() };

    let mut counter: u64 = 0;
    for (idx, chunk) in tar_chunks.iter().enumerate() {
        println!("[rec-diag-rust] chunk {} size: {} bytes", idx, chunk.len());
        extract_chunk_renamed(chunk, &frames_dir, &mut counter)
            .map_err(|e| format!("чанк {}: {}", idx, e))?;
    }

    let frames: Vec<_> = std::fs::read_dir(&frames_dir)
        .map_err(|e| format!("read_dir: {}", e))?
        .filter_map(|e| e.ok())
        .collect();
    if let (Some(first), Some(last)) = (frames.first(), frames.last()) {
        let fsize = first.metadata().map(|m| m.len()).unwrap_or(0);
        let lsize = last.metadata().map(|m| m.len()).unwrap_or(0);
        println!(
            "[rec-diag-rust] frame sizes: first {} bytes, last {} bytes, total {} files",
            fsize, lsize, frames.len(),
        );
    }

    println!(
        "[build_video] чанков {}, всего png {}, папка {}",
        tar_chunks.len(),
        counter,
        frames_dir.display(),
    );

    if counter == 0 {
        return Err("в tar-чанках нет png кадров".into());
    }

    let ext = if audio_extension.is_empty() { "bin".to_string() } else { audio_extension };
    let audio_path = tmp_dir.join(format!("mvapp_audio_{}_{}.{}", pid, ts, ext));
    std::fs::write(&audio_path, &audio_bytes)
        .map_err(|e| format!("не удалось записать временное аудио: {}", e))?;
    let _audio_guard = TempFileGuard { path: audio_path.clone() };

    let frames_pattern = frames_dir.join("frame_%07d.jpg").to_string_lossy().to_string();
    let audio_str = audio_path.to_string_lossy().to_string();
    let fps_str = fps.to_string();

    let encoder = primary_encoder();
    println!(
        "[build_video] {}x{} @ {} fps, энкодер {}",
        width, height, fps, encoder,
    );

    let args = build_ffmpeg_args(
        encoder, &fps_str, width, height, &frames_pattern, &audio_str, &output_path,
    );
    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let ffmpeg_start = std::time::Instant::now();
    let first = app
        .shell()
        .command("ffmpeg")
        .args(&str_args)
        .output()
        .await
        .map_err(|e| {
            format!(
                "ffmpeg не запустился (проверь что он установлен и доступен в PATH): {}",
                e,
            )
        })?;
    println!("[rec-diag-rust] ffmpeg took {:.2}s", ffmpeg_start.elapsed().as_secs_f64());

    if first.status.success() {
        return Ok(());
    }

    let first_stderr = String::from_utf8_lossy(&first.stderr).to_string();
    eprintln!("[build_video] {} упал:\n{}", encoder, first_stderr);

    if encoder == "libx264" {
        return Err(format!("ffmpeg завершился с ошибкой:\n{}", first_stderr));
    }

    eprintln!("[build_video] пробую libx264");
    let fb_args = build_ffmpeg_args(
        "libx264", &fps_str, width, height, &frames_pattern, &audio_str, &output_path,
    );
    let fb_str_args: Vec<&str> = fb_args.iter().map(|s| s.as_str()).collect();
    let fb_start = std::time::Instant::now();
    let fb = app
        .shell()
        .command("ffmpeg")
        .args(&fb_str_args)
        .output()
        .await
        .map_err(|e| format!("fallback libx264 не запустился: {}", e))?;
    println!("[rec-diag-rust] ffmpeg (libx264 fallback) took {:.2}s", fb_start.elapsed().as_secs_f64());

    if fb.status.success() {
        Ok(())
    } else {
        let fb_stderr = String::from_utf8_lossy(&fb.stderr);
        Err(format!(
            "ffmpeg не справился ни с {}, ни с libx264.\n{} stderr:\n{}\nlibx264 stderr:\n{}",
            encoder, encoder, first_stderr, fb_stderr,
        ))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let env_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".env");
    let _ = dotenvy::from_path(env_path);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            diag_log_append,
            prepare_export_dir,
            cleanup_export_dir,
            build_video_from_dir,
            build_video_from_png_tar,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
