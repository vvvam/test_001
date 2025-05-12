use arboard::Clipboard;
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use std::thread;
use tauri::{AppHandle, Manager};
use tauri::{Listener, Emitter};
use crate::clipboard::ClipboardItem;
use crate::AppState;
use base64::{engine::general_purpose, Engine as _};
use image::{ImageBuffer, Rgba};
use std::io::Cursor;
use lazy_static;

// 定义一个全局变量来控制监控状态
lazy_static::lazy_static! {
    static ref MONITOR_ENABLED: AtomicBool = AtomicBool::new(true);
}

// 保存上一次的剪贴板内容，用于比较变化
struct ClipboardContent {
    last_text: Option<String>,
}

impl ClipboardContent {
    fn new() -> Self {
        Self {
            last_text: None,
        }
    }
}

// 计算图片的简单哈希值（用于比较图片是否变化）
fn calculate_image_hash(img: &arboard::ImageData) -> String {
    // 简单的哈希算法：使用图片的宽高和少量抽样像素
    let width = img.width as u32;
    let height = img.height as u32;
    let bytes = &img.bytes;
    
    // 如果图片太小，直接返回
    if width < 10 || height < 10 {
        return format!("{}x{}", width, height);
    }
    
    // 对图片进行采样
    let mut sample_points = Vec::new();
    for x_pct in [0, 25, 50, 75, 99] {
        for y_pct in [0, 25, 50, 75, 99] {
            let x = (width * x_pct as u32) / 100;
            let y = (height * y_pct as u32) / 100;
            
            // 计算像素位置 - arboard的ImageData使用RGBA格式，每像素4字节
            let stride = width as usize * 4; // 每行的字节数
            let idx = (y as usize * stride) + (x as usize * 4); 
            if idx + 3 < bytes.len() {
                sample_points.push(format!("{}{}{}{}", 
                    bytes[idx], bytes[idx+1], bytes[idx+2], bytes[idx+3]));
            }
        }
    }
    
    // 连接采样点值形成哈希值
    sample_points.join("")
}

// 将图片转换为Base64编码的字符串
fn image_to_base64(img: &arboard::ImageData) -> Result<String, Box<dyn std::error::Error>> {
    // 将arboard::ImageData转换为image::RgbaImage
    let width = img.width as u32;
    let height = img.height as u32;
    let bytes = &img.bytes;
    
    // 创建一个新的图像缓冲区
    let mut rgba_image = ImageBuffer::<Rgba<u8>, Vec<u8>>::new(width, height);
    
    for y in 0..height {
        for x in 0..width {
            // 计算像素位置 - arboard的ImageData使用RGBA格式，每像素4字节
            let stride = width as usize * 4; // 每行的字节数
            let idx_src = (y as usize * stride) + (x as usize * 4);
            if idx_src + 3 < bytes.len() {
                let r = bytes[idx_src];
                let g = bytes[idx_src + 1];
                let b = bytes[idx_src + 2];
                let a = bytes[idx_src + 3];
                rgba_image.put_pixel(x, y, Rgba([r, g, b, a]));
            }
        }
    }
    
    // 将图像编码为PNG，使用内存缓冲区而不是文件
    let mut buffer = Vec::new();
    {
        let mut cursor = Cursor::new(&mut buffer);
        rgba_image.write_to(&mut cursor, image::ImageFormat::Png)?;
    }
    let b64 = general_purpose::STANDARD.encode(&buffer);
    Ok(format!("data:image/png;base64,{}", b64))
}

// 启动剪贴板监控
pub fn start_monitoring(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // println!("开始初始化剪贴板监控...");
    
    // 创建一个线程安全的共享状态，用于存储最近的剪贴板内容
    let content = Arc::new(Mutex::new(ClipboardContent::new()));
    
    // 创建一个原子布尔值，用于控制监控线程的生命周期
    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();
    
    // 创建一个新线程来监控剪贴板变化
    let app_handle_clone = app_handle.clone();
    let _monitor_thread = thread::spawn(move || {
        // println!("剪贴板监控线程启动");
        
        // 创建一个新的剪贴板实例
        let mut clipboard = match Clipboard::new() {
            Ok(cb) => cb,
            Err(e) => {
                eprintln!("无法创建剪贴板实例: {}", e);
                return;
            }
        };
        
        let mut error_count = 0;
        const MAX_ERRORS: usize = 10;
        let mut empty_clipboard_messages = 0; // 空剪贴板消息计数
        
        // 循环检查剪贴板变化
        while running_clone.load(Ordering::Relaxed) {
            // 检查是否暂停监控
            if !MONITOR_ENABLED.load(Ordering::Relaxed) {
                // 监控已暂停，等待一会再检查状态
                thread::sleep(Duration::from_millis(1000));
                continue;
            }
            
            // 尝试读取剪贴板文本
            match clipboard.get_text() {
                Ok(current_text) => {
                    error_count = 0; // 重置错误计数
                    empty_clipboard_messages = 0; // 重置空剪贴板消息计数
                    
                    // 获取之前的内容进行比较
                    let mut content_guard = content.lock().unwrap();
                    
                    // 检查内容是否发生变化且不为空
                    if !current_text.is_empty() && content_guard.last_text.as_ref() != Some(&current_text) {
                        // println!("检测到剪贴板文本内容变化");
                        
                        // 更新最新的内容
                        content_guard.last_text = Some(current_text.clone());
                        
                        // 处理新的剪贴板内容（保存到存储）
                        process_new_text_content(&app_handle_clone, current_text);
                    }
                },
                Err(e) => {
                    // 如果是空剪贴板或格式不匹配，减少日志输出
                    let error_msg = e.to_string();
                    if error_msg.contains("were not available") || error_msg.contains("empty") {
                        empty_clipboard_messages += 1;
                        // 只在第一次和每100次后打印一次空剪贴板消息
                        if empty_clipboard_messages == 1 || empty_clipboard_messages % 100 == 0 {
                            // println!("剪贴板为空或格式不匹配 (计数: {})", empty_clipboard_messages);
                        }
                    } else {
                        // 其他错误正常计数和打印
                        error_count += 1;
                        // eprintln!("读取剪贴板文本失败: {} (错误 {}/{})", e, error_count, MAX_ERRORS);
                        if error_count >= MAX_ERRORS {
                            eprintln!("连续读取剪贴板失败次数过多，停止监听。");
                            break; // Exit the loop after too many errors
                        }
                    }
                    
                    if error_count >= MAX_ERRORS {
                        // 重新创建剪贴板实例
                        clipboard = match Clipboard::new() {
                            Ok(cb) => {
                                error_count = 0;
                                cb
                            },
                            Err(e) => {
                                eprintln!("重新创建剪贴板实例失败: {}", e);
                                continue;
                            }
                        };
                    }
                }
            }
            
            // 暂停时间增加到1秒，降低CPU使用率和减少日志输出
            thread::sleep(Duration::from_millis(1000));
        }
        
        // println!("剪贴板监控线程结束");
    });
    
    // 确保应用关闭时停止监控线程
    let app_handle_for_cleanup = app_handle.clone();
    let _listener_id = app_handle.listen("tauri://close-requested", move |_| {
        // println!("应用正在关闭，停止剪贴板监控...");
        running.store(false, Ordering::Relaxed);
        
        // 允许应用关闭
        app_handle_for_cleanup.emit("tauri://close", ()).unwrap();
    });
    
    // println!("剪贴板监控设置完成");
    Ok(())
}

// 处理新的文本内容
fn process_new_text_content(app_handle: &AppHandle, content: String) {
    // 创建新的剪贴板条目
    let new_item = ClipboardItem::new(content);
    
    // 保存新条目
    let save_result = if let Some(state) = app_handle.try_state::<AppState>() {
        let mut storage = match state.storage.lock() {
            Ok(storage) => storage,
            Err(e) => {
                eprintln!("无法获取存储锁: {:?}", e);
                return;
            }
        };
        
        let save_result = storage.add_item(new_item.clone());
        
        if save_result.is_ok() {
            // println!("已保存剪贴板文本内容到历史记录");
            true
        } else {
            // println!("保存剪贴板文本内容失败: {:?}", save_result.err());
            false
        }
    } else {
        // println!("获取应用状态失败");
        false
    };
    
    // 保存成功后发送事件通知前端更新数据
    if save_result {
        // 发送事件通知前端更新数据
        match app_handle.emit("clipboard-change", ()) {
            Ok(_) => {} // println!("成功发送剪贴板更新事件"),
            Err(e) => {} // println!("发送剪贴板更新事件失败: {:?}", e),
        }
    }
}

// 处理新的图片内容
fn process_new_image_content(app_handle: &AppHandle, base64_image: String) {
    // 创建新的剪贴板条目，标记为图片类型
    let mut new_item = ClipboardItem::new(base64_image);
    new_item.category = Some("image".to_string()); // 设置类别为图片
    
    // 保存新条目
    let save_result = if let Some(state) = app_handle.try_state::<AppState>() {
        let mut storage = match state.storage.lock() {
            Ok(storage) => storage,
            Err(e) => {
                eprintln!("无法获取存储锁: {:?}", e);
                return;
            }
        };
        
        let save_result = storage.add_item(new_item.clone());
        
        if save_result.is_ok() {
            // println!("已保存剪贴板图片内容到历史记录");
            true
        } else {
            // println!("保存剪贴板图片内容失败: {:?}", save_result.err());
            false
        }
    } else {
        // println!("获取应用状态失败");
        false
    };
    
    // 保存成功后发送事件通知前端更新数据
    if save_result {
        // 发送事件通知前端更新数据
        match app_handle.emit("clipboard-change", ()) {
            Ok(_) => {} // println!("成功发送剪贴板更新事件"),
            Err(e) => {} // println!("发送剪贴板更新事件失败: {:?}", e),
        }
    }
}

// 新增：获取剪贴板监控状态
#[tauri::command]
pub fn get_clipboard_monitor_status() -> bool {
    MONITOR_ENABLED.load(Ordering::Relaxed)
}

// 新增：暂停剪贴板监控
#[tauri::command]
pub fn pause_clipboard_monitor() -> bool {
    // println!("暂停剪贴板监控");
    MONITOR_ENABLED.store(false, Ordering::Relaxed);
    false
}

// 新增：恢复剪贴板监控
#[tauri::command]
pub fn resume_clipboard_monitor() -> bool {
    // println!("恢复剪贴板监控");
    MONITOR_ENABLED.store(true, Ordering::Relaxed);
    true
}

// 新增：切换剪贴板监控状态
#[tauri::command]
pub fn toggle_clipboard_monitor() -> bool {
    let current = MONITOR_ENABLED.load(Ordering::Relaxed);
    let new_status = !current;
    // println!("切换剪贴板监控状态: {}", if new_status { "启动" } else { "暂停" });
    MONITOR_ENABLED.store(new_status, Ordering::Relaxed);
    new_status
} 