use std::io::Read;
use tauri_plugin_shell::ShellExt;
use tauri::Emitter;

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

#[cfg(target_os = "windows")]
fn windows_pick_loopback_device(host: &cpal::Host) -> Result<cpal::Device, String> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let probe = |d: &cpal::Device| -> Result<(), String> {
        let cfg = d
            .default_input_config()
            .map_err(|e| format!("default_input_config: {}", e))?;
        let sample_format = cfg.sample_format();
        let stream_config: cpal::StreamConfig = cfg.into();
        let err_fn = |_e| {};
        let probe_stream: Result<cpal::Stream, _> = match sample_format {
            cpal::SampleFormat::F32 => d.build_input_stream(
                &stream_config,
                |_data: &[f32], _: &cpal::InputCallbackInfo| {},
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => d.build_input_stream(
                &stream_config,
                |_data: &[i16], _: &cpal::InputCallbackInfo| {},
                err_fn,
                None,
            ),
            cpal::SampleFormat::U16 => d.build_input_stream(
                &stream_config,
                |_data: &[u16], _: &cpal::InputCallbackInfo| {},
                err_fn,
                None,
            ),
            other => return Err(format!("unsupported sample format: {:?}", other)),
        };
        let _stream = probe_stream.map_err(|e| format!("build probe: {}", e))?;
        Ok(())
    };

    if let Some(d) = host.default_output_device() {
        let name = d.name().unwrap_or_else(|_| "unknown".to_string());
        match probe(&d) {
            Ok(()) => {
                println!("[system-capture] using device: {}", name);
                return Ok(d);
            }
            Err(e) => {
                println!(
                    "[system-capture] default output {} skipped: {}",
                    name, e
                );
            }
        }
    }

    let mut tried: usize = 0;
    let iter = host
        .output_devices()
        .map_err(|e| format!("output_devices: {}", e))?;
    for d in iter {
        tried += 1;
        let name = d.name().unwrap_or_else(|_| "unknown".to_string());
        match probe(&d) {
            Ok(()) => {
                println!("[system-capture] using device: {}", name);
                return Ok(d);
            }
            Err(e) => {
                println!(
                    "[system-capture] candidate {} skipped: {}",
                    name, e
                );
            }
        }
    }

    Err(format!(
        "WINDOWS_NO_LOOPBACK_DEVICE: tried {} devices, none supports loopback",
        tried
    ))
}

#[tauri::command]
async fn start_system_audio_test(app_handle: tauri::AppHandle) -> Result<String, String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use std::sync::{Arc, Mutex};
    use std::sync::mpsc;

    let (result_tx, result_rx) = mpsc::channel::<Result<String, String>>();
    let app_for_thread = app_handle.clone();

    std::thread::spawn(move || {
        let host = cpal::default_host();

        #[cfg(target_os = "macos")]
        let device_result: Result<cpal::Device, String> = (|| {
            let mut devices = host
                .input_devices()
                .map_err(|e| format!("не удалось получить input_devices: {}", e))?;
            devices
                .find(|d| {
                    d.name()
                        .map(|n| n.to_lowercase().contains("blackhole"))
                        .unwrap_or(false)
                })
                .ok_or_else(|| "BLACKHOLE_NOT_FOUND".to_string())
        })();

        #[cfg(target_os = "windows")]
        let device_result: Result<cpal::Device, String> = windows_pick_loopback_device(&host);

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let device_result: Result<cpal::Device, String> =
            Err("UNSUPPORTED_PLATFORM".to_string());

        let device = match device_result {
            Ok(d) => d,
            Err(e) => {
                let _ = result_tx.send(Err(e));
                return;
            }
        };

        let device_name = device.name().unwrap_or_else(|_| "unknown".to_string());
        println!("[system-audio-test] устройство: {}", device_name);

        let config = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                let _ = result_tx
                    .send(Err(format!("default_input_config: {}", e)));
                return;
            }
        };

        println!(
            "[system-audio-test] config: sample_rate={} channels={} format={:?}",
            config.sample_rate().0,
            config.channels(),
            config.sample_format(),
        );

        let sample_format = config.sample_format();
        let stream_config: cpal::StreamConfig = config.clone().into();
        let channels = stream_config.channels as usize;

        let accumulator: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
        let acc_for_callback = accumulator.clone();

        let err_fn = |err| eprintln!("[system-audio-test] stream error: {}", err);

        let stream_result: Result<cpal::Stream, String> = match sample_format {
            cpal::SampleFormat::F32 => device
                .build_input_stream(
                    &stream_config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        let mut acc = acc_for_callback.lock().unwrap();
                        acc.extend_from_slice(data);
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("build_input_stream F32: {}", e)),
            cpal::SampleFormat::I16 => device
                .build_input_stream(
                    &stream_config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        let mut acc = acc_for_callback.lock().unwrap();
                        acc.extend(data.iter().map(|&s| s as f32 / i16::MAX as f32));
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("build_input_stream I16: {}", e)),
            cpal::SampleFormat::U16 => device
                .build_input_stream(
                    &stream_config,
                    move |data: &[u16], _: &cpal::InputCallbackInfo| {
                        let mut acc = acc_for_callback.lock().unwrap();
                        acc.extend(data.iter().map(|&s| {
                            (s as f32 - u16::MAX as f32 / 2.0) / (u16::MAX as f32 / 2.0)
                        }));
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| format!("build_input_stream U16: {}", e)),
            other => Err(format!("неподдерживаемый sample format: {:?}", other)),
        };

        let stream = match stream_result {
            Ok(s) => s,
            Err(e) => {
                let _ = result_tx.send(Err(e));
                return;
            }
        };

        if let Err(e) = stream.play() {
            let _ = result_tx.send(Err(format!("stream.play: {}", e)));
            return;
        }

        let start = std::time::Instant::now();
        let total_duration = std::time::Duration::from_secs(5);
        let tick = std::time::Duration::from_millis(100);

        while start.elapsed() < total_duration {
            std::thread::sleep(tick);
            let samples = {
                let mut acc = accumulator.lock().unwrap();
                std::mem::take(&mut *acc)
            };
            if samples.is_empty() {
                let _ = app_for_thread.emit("system-audio-level", 0.0f32);
                continue;
            }
            let frames = samples.len() / channels.max(1);
            let sum_sq: f32 = samples.iter().map(|s| s * s).sum();
            let rms = if frames > 0 {
                (sum_sq / samples.len() as f32).sqrt()
            } else {
                0.0
            };
            let _ = app_for_thread.emit("system-audio-level", rms);
        }

        drop(stream);
        let _ = result_tx.send(Ok("Capture stopped after 5s".to_string()));
    });

    tauri::async_runtime::spawn_blocking(move || {
        result_rx
            .recv()
            .unwrap_or_else(|e| Err(format!("канал закрыт: {}", e)))
    })
    .await
    .map_err(|e| format!("join error: {}", e))?
}

#[tauri::command]
async fn stop_system_audio_test() -> Result<String, String> {
    Ok("Stopped".to_string())
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SystemCaptureInfo {
    sample_rate: u32,
    channels: u16,
}

#[derive(serde::Serialize, Clone)]
struct SystemAudioSamples {
    samples: Vec<f32>,
    timestamp: u64,
}

fn capture_stop_tx() -> &'static std::sync::Mutex<Option<std::sync::mpsc::Sender<()>>> {
    static T: std::sync::OnceLock<std::sync::Mutex<Option<std::sync::mpsc::Sender<()>>>> =
        std::sync::OnceLock::new();
    T.get_or_init(|| std::sync::Mutex::new(None))
}

#[tauri::command]
async fn start_system_capture(
    app_handle: tauri::AppHandle,
) -> Result<SystemCaptureInfo, String> {
    use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
    use std::sync::{mpsc, Arc, Mutex as StdMutex};

    let prev = {
        let mut guard = capture_stop_tx().lock().unwrap();
        guard.take()
    };
    if let Some(tx) = prev {
        tauri::async_runtime::spawn_blocking(move || {
            let _ = tx.send(());
            std::thread::sleep(std::time::Duration::from_millis(150));
        })
        .await
        .ok();
    }

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (init_tx, init_rx) = mpsc::channel::<Result<SystemCaptureInfo, String>>();
    let app_for_thread = app_handle.clone();

    std::thread::spawn(move || {
        let host = cpal::default_host();

        #[cfg(target_os = "macos")]
        let device_result: Result<cpal::Device, String> = (|| {
            let mut devices = host
                .input_devices()
                .map_err(|e| format!("не удалось получить input_devices: {}", e))?;
            devices
                .find(|d| {
                    d.name()
                        .map(|n| n.to_lowercase().contains("blackhole"))
                        .unwrap_or(false)
                })
                .ok_or_else(|| "BLACKHOLE_NOT_FOUND".to_string())
        })();

        #[cfg(target_os = "windows")]
        let device_result: Result<cpal::Device, String> = windows_pick_loopback_device(&host);

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let device_result: Result<cpal::Device, String> =
            Err("UNSUPPORTED_PLATFORM".to_string());

        let device = match device_result {
            Ok(d) => d,
            Err(e) => {
                let _ = init_tx.send(Err(e));
                return;
            }
        };

        let device_name = device.name().unwrap_or_else(|_| "unknown".to_string());
        println!("[system-capture] устройство: {}", device_name);

        let config = match device.default_input_config() {
            Ok(c) => c,
            Err(e) => {
                let _ = init_tx.send(Err(format!("default_input_config: {}", e)));
                return;
            }
        };

        let sample_format = config.sample_format();
        let stream_config: cpal::StreamConfig = config.clone().into();
        let channels = stream_config.channels as usize;
        let sample_rate = stream_config.sample_rate.0;

        println!(
            "[system-capture] sample_rate={} channels={} format={:?}",
            sample_rate, channels, sample_format,
        );

        let accumulator: Arc<StdMutex<Vec<f32>>> =
            Arc::new(StdMutex::new(Vec::with_capacity(16384)));
        let err_fn = |err| eprintln!("[system-capture] stream error: {}", err);

        let stream_result: Result<cpal::Stream, String> = match sample_format {
            cpal::SampleFormat::F32 => {
                let acc_cb = accumulator.clone();
                let chans = channels;
                device
                    .build_input_stream(
                        &stream_config,
                        move |data: &[f32], _: &cpal::InputCallbackInfo| {
                            let mut acc = acc_cb.lock().unwrap();
                            if chans <= 1 {
                                acc.extend_from_slice(data);
                            } else {
                                let frames = data.len() / chans;
                                for f in 0..frames {
                                    let base = f * chans;
                                    let mut sum = 0.0f32;
                                    for ch in 0..chans {
                                        sum += data[base + ch];
                                    }
                                    acc.push(sum / chans as f32);
                                }
                            }
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| format!("build_input_stream F32: {}", e))
            }
            cpal::SampleFormat::I16 => {
                let acc_cb = accumulator.clone();
                let chans = channels;
                device
                    .build_input_stream(
                        &stream_config,
                        move |data: &[i16], _: &cpal::InputCallbackInfo| {
                            let mut acc = acc_cb.lock().unwrap();
                            let scale = 1.0 / (i16::MAX as f32);
                            if chans <= 1 {
                                acc.extend(data.iter().map(|&s| s as f32 * scale));
                            } else {
                                let frames = data.len() / chans;
                                for f in 0..frames {
                                    let base = f * chans;
                                    let mut sum = 0.0f32;
                                    for ch in 0..chans {
                                        sum += data[base + ch] as f32 * scale;
                                    }
                                    acc.push(sum / chans as f32);
                                }
                            }
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| format!("build_input_stream I16: {}", e))
            }
            cpal::SampleFormat::U16 => {
                let acc_cb = accumulator.clone();
                let chans = channels;
                device
                    .build_input_stream(
                        &stream_config,
                        move |data: &[u16], _: &cpal::InputCallbackInfo| {
                            let mut acc = acc_cb.lock().unwrap();
                            let bias = u16::MAX as f32 / 2.0;
                            let scale = 1.0 / bias;
                            let to_f = |s: u16| (s as f32 - bias) * scale;
                            if chans <= 1 {
                                acc.extend(data.iter().map(|&s| to_f(s)));
                            } else {
                                let frames = data.len() / chans;
                                for f in 0..frames {
                                    let base = f * chans;
                                    let mut sum = 0.0f32;
                                    for ch in 0..chans {
                                        sum += to_f(data[base + ch]);
                                    }
                                    acc.push(sum / chans as f32);
                                }
                            }
                        },
                        err_fn,
                        None,
                    )
                    .map_err(|e| format!("build_input_stream U16: {}", e))
            }
            other => Err(format!("неподдерживаемый sample format: {:?}", other)),
        };

        let stream = match stream_result {
            Ok(s) => s,
            Err(e) => {
                let _ = init_tx.send(Err(e));
                return;
            }
        };

        if let Err(e) = stream.play() {
            let _ = init_tx.send(Err(format!("stream.play: {}", e)));
            return;
        }

        let _ = init_tx.send(Ok(SystemCaptureInfo {
            sample_rate,
            channels: channels as u16,
        }));

        const BATCH_SIZE: usize = 2048;
        const MAX_BUFFER: usize = BATCH_SIZE * 8;

        loop {
            let stop_msg = stop_rx.recv_timeout(std::time::Duration::from_millis(50));
            let should_stop = match stop_msg {
                Ok(_) => true,
                Err(mpsc::RecvTimeoutError::Disconnected) => true,
                Err(mpsc::RecvTimeoutError::Timeout) => false,
            };

            let drained: Option<Vec<f32>> = {
                let mut acc = accumulator.lock().unwrap();
                let len = acc.len();
                if len > MAX_BUFFER {
                    let drop_count = len - BATCH_SIZE;
                    acc.drain(..drop_count);
                }
                if acc.len() >= BATCH_SIZE {
                    Some(acc.drain(..BATCH_SIZE).collect())
                } else {
                    None
                }
            };

            if let Some(samples) = drained {
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                let _ = app_for_thread.emit(
                    "system-audio-samples",
                    SystemAudioSamples { samples, timestamp },
                );
            }

            if should_stop {
                break;
            }
        }

        drop(stream);
        println!("[system-capture] остановлен");
    });

    let join_result = tauri::async_runtime::spawn_blocking(move || init_rx.recv())
        .await
        .map_err(|e| format!("join: {}", e))?;
    let init_result = join_result
        .unwrap_or_else(|_| Err("init канал закрыт".to_string()));
    let info = init_result?;

    {
        let mut guard = capture_stop_tx().lock().unwrap();
        *guard = Some(stop_tx);
    }

    Ok(info)
}

#[tauri::command]
async fn stop_system_capture() -> Result<String, String> {
    let tx = {
        let mut guard = capture_stop_tx().lock().unwrap();
        guard.take()
    };
    if let Some(t) = tx {
        let _ = t.send(());
    }
    Ok("Stopped".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
            start_system_audio_test,
            stop_system_audio_test,
            start_system_capture,
            stop_system_capture
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
