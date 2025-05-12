// 避免未使用代码的警告
#![allow(unused_imports)]
// 防止控制台窗口在Windows上出现
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clipboard;
mod ai;
mod storage;
mod clipboard_monitor;
mod role;
mod role_storage;
mod translation;

use clipboard::{ClipboardItem, ClipboardOperationResult, ClipboardFilter};
use storage::Storage;
use ai::{AIManager, AIRole, AIConfig, AISettings, AIProviderSetting, AISettingsManager, ModelInfo, APITestResult};
use role::{Role, RoleOperationResult};
use role_storage::RoleStorage;
use translation::{TranslationManager, TranslationState, TranslationSettings, TranslationResult, LanguageInfo};
use std::sync::Mutex;
use tauri::{Manager, State, Emitter, AppHandle};
use tauri_plugin_autostart::MacosLauncher;
use std::path::PathBuf;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri::Listener;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use sysinfo::{System, SystemExt, CpuExt};
use ai::chat_completion;

// 应用状态
struct AppState {
    storage: Mutex<Storage>,
    ai_manager: Mutex<AIManager>,
    role_storage: Mutex<RoleStorage>,
    ai_settings_manager: Mutex<AISettingsManager>,
    translation_manager: Mutex<TranslationManager>,
}

// 获取最大历史记录数量
#[tauri::command]
fn get_max_history_items(state: State<AppState>) -> Result<usize, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    Ok(storage.get_max_items())
}

// 设置最大历史记录数量
#[tauri::command]
fn set_max_history_items(state: State<AppState>, max_items: usize) -> Result<(), String> {
    // println!("设置最大历史记录数量: {}", max_items);
    
    // 检查数值范围
    if max_items < 10 {
        let error_msg = format!("最大历史记录数量不能小于10: {}", max_items);
        // eprintln!("{}", error_msg);
        return Err(error_msg);
    }
    
    // 获取storage的锁
    let mut storage = match state.storage.lock() {
        Ok(storage) => {
            // println!("成功获取存储锁");
            storage
        },
        Err(e) => {
            let error_msg = format!("获取存储锁失败: {}", e);
            // eprintln!("{}", error_msg);
            return Err(error_msg);
        }
    };
    
    // 设置最大记录数并保存
    match storage.set_max_items(max_items) {
        Ok(_) => {
            // println!("成功设置最大历史记录数量: {}", max_items);
            Ok(())
        },
        Err(e) => {
            let error_msg = format!("设置最大历史记录数量失败: {}", e);
            // eprintln!("{}", error_msg);
            Err(error_msg)
        }
    }
}

// 初始化应用
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // 创建应用数据目录
            let app_handle = app.handle();
            let app_dir = app_handle.path().app_data_dir()?;
            
            // 确保应用数据目录存在，添加详细日志
            // println!("应用数据目录: {:?}", app_dir);
            match std::fs::create_dir_all(&app_dir) {
                Ok(_) => {}, // println!("成功创建或确认应用数据目录存在: {:?}", app_dir),
                Err(e) => {
                    let _error_msg = format!("创建应用数据目录失败: {:?} - {}", app_dir, e);
                    // eprintln!("{}", error_msg);
                    // 尝试其他位置或返回错误
                    return Err(e.into());
                }
            }
            
            // 验证目录写入权限
            let test_file_path = app_dir.join("write_test.tmp");
            match std::fs::write(&test_file_path, b"test") {
                Ok(_) => {
                    // println!("应用数据目录写入权限验证成功");
                    // 删除测试文件
                    let _ = std::fs::remove_file(&test_file_path);
                },
                Err(e) => {
                    let _error_msg = format!("应用数据目录写入权限验证失败: {:?} - {}", app_dir, e);
                    // eprintln!("{}", error_msg);
                    return Err(e.into());
                }
            }
            
            // 初始化存储
            let storage_file = app_dir.join("clipboard_history.json");
            let storage = Storage::new(storage_file);
            
            // 初始化AI管理器
            let ai_manager = AIManager::new(app_dir.clone());
            
            // 初始化角色存储
            let role_storage_file = app_dir.join("roles.json");
            let role_storage = RoleStorage::new(role_storage_file);
            
            // 初始化AI设置管理器
            let ai_settings_manager = AISettingsManager::new(app_dir.clone());
            
            // 初始化翻译管理器
            let translation_manager = TranslationManager::new(app_dir.clone());
            
            // 为TranslationState创建一个克隆的实例
            let translation_manager_clone = translation_manager.clone();
            
            // 设置应用状态
            app.manage(AppState {
                storage: Mutex::new(storage),
                ai_manager: Mutex::new(ai_manager),
                role_storage: Mutex::new(role_storage),
                ai_settings_manager: Mutex::new(ai_settings_manager),
                translation_manager: Mutex::new(translation_manager),
            });
            
            // 注册翻译状态（使用克隆的实例）
            app.manage(TranslationState {
                manager: Mutex::new(translation_manager_clone),
            });
            
            // 开始监听系统剪贴板变化
            match clipboard_monitor::start_monitoring(app_handle.clone()) {
                Ok(_) => {}, // println!("剪贴板监控启动成功"),
                Err(_e) => {} // eprintln!("剪贴板监控启动失败: {}", e)
            }
            
            // 注册快捷键处理函数
            setup_shortcut_handling(&app_handle);
            
            // 监听创建浮动剪贴板窗口事件
            let create_float_handle = app_handle.clone();
            app_handle.listen("create-float-clipboard-window", move |_| {
                create_float_clipboard_window(&create_float_handle);
            });
            
            // 监听隐藏浮动剪贴板窗口事件
            let hide_float_handle = app_handle.clone();
            app_handle.listen("hide-float-clipboard-window", move |_| {
                if let Some(window) = hide_float_handle.get_webview_window("float_clipboard") {
                    // println!("隐藏浮动剪贴板窗口");
                    let _ = window.hide();
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_clipboard_history,
            get_max_history_items,
            set_max_history_items,
            add_clipboard_item,
            update_clipboard_item,
            remove_clipboard_item,
            copy_to_clipboard,
            clear_clipboard_history,
            translate_content,
            summarize_content,
            analyze_with_ai,
            edit_clipboard_item,
            get_ai_roles,
            add_ai_role,
            update_ai_role,
            delete_ai_role,
            get_ai_config,
            update_ai_config,
            get_roles,
            add_role,
            update_role,
            delete_role,
            reset_role,
            get_role,
            update_shortcut,
            get_ai_settings,
            update_ai_settings,
            get_provider_setting,
            update_provider_setting,
            fetch_models,
            test_api_connection,
            chat_with_ai,
            get_clipboard_count,
            get_system_info,
            chat_completion,
            translation::get_supported_languages,
            translation::get_translation_settings,
            translation::test_translation_api,
            translation::translate_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// 设置快捷键处理
fn setup_shortcut_handling(app_handle: &tauri::AppHandle) {
    // println!("开始设置快捷键处理...");

    // 获取对快捷键管理器的引用
    let shortcut_manager = app_handle.global_shortcut();
    
    // 注册Alt+C快捷键（主窗口）
    if let Err(_err) = shortcut_manager.register("Alt+C") {
        // eprintln!("注册Alt+C快捷键失败: {}", err);
    } else {
        // println!("成功注册Alt+C快捷键");
    }
    
    // 注册Alt+F快捷键（浮动剪贴板窗口）
    if let Err(_err) = shortcut_manager.register("Alt+F") {
        // eprintln!("注册Alt+F快捷键失败: {}", err);
    } else {
        // println!("成功注册Alt+F快捷键");
    }
    
    // 验证快捷键是否已注册
    if shortcut_manager.is_registered("Alt+C") {
        // println!("验证 Alt+C 快捷键已注册成功");
    } else {
        // println!("警告: Alt+C 快捷键注册验证失败");
    }
    
    if shortcut_manager.is_registered("Alt+F") {
        // println!("验证 Alt+F 快捷键已注册成功");
    } else {
        // println!("警告: Alt+F 快捷键注册验证失败");
    }
    
    // 设置快捷键事件监听
    let handle_clone = app_handle.clone();
    app_handle.listen("tauri://global-shortcut", move |event| {
        let payload = event.payload();
        // println!("触发快捷键事件: {}", payload);
        
        // 尝试解析JSON payload
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(payload) {
            if let Some(shortcut) = value.get("shortcut").and_then(|s| s.as_str()) {
                match shortcut {
                    "Alt+C" => {
                        // 显示/隐藏主窗口
                        if let Some(window) = handle_clone.get_webview_window("main") {
                            match window.is_visible() {
                                Ok(true) => {
                                    // println!("隐藏主窗口");
                                    let _ = window.hide();
                                },
                                Ok(false) => {
                                    // println!("显示主窗口");
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                },
                                Err(_e) => {} // eprintln!("无法确定窗口可见性: {}", e)
                            }
                        } else {
                            // println!("找不到主窗口，无法处理Alt+C快捷键");
                        }
                    },
                    "Alt+F" => {
                        // 显示/隐藏浮动剪贴板窗口
                        if let Some(window) = handle_clone.get_webview_window("float_clipboard") {
                            match window.is_visible() {
                                Ok(true) => {
                                    // println!("隐藏浮动窗口");
                                    let _ = window.hide();
                                },
                                Ok(false) => {
                                    // println!("显示浮动窗口");
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                },
                                Err(_e) => {} // eprintln!("无法确定窗口可见性: {}", e)
                            }
                        } else {
                            // println!("浮动窗口不存在，尝试创建...");
                            create_float_clipboard_window(&handle_clone);
                        }
                    },
                    _ => {} // println!("未知快捷键: {}", shortcut)
                }
            }
        } else {
            // println!("无法解析快捷键事件: {}", payload);
        }
    });
    
    // println!("快捷键设置完成");
}

// 创建浮动剪贴板窗口
fn create_float_clipboard_window(app_handle: &tauri::AppHandle) {
    // 检查是否已存在浮动窗口
    if app_handle.get_webview_window("float_clipboard").is_some() {
        // 如果窗口已存在，则显示并聚焦
        if let Some(window) = app_handle.get_webview_window("float_clipboard") {
            // println!("浮动窗口已存在，显示并聚焦");
            let _ = window.show();
            let _ = window.set_focus();
        }
        return;
    }
    
    // println!("创建新的浮动窗口");
    let builder = tauri::WebviewWindowBuilder::new(
        app_handle, // 使用引用类型，不需要克隆
        "float_clipboard", // 窗口唯一标识符
        tauri::WebviewUrl::App("index.html?window=float_clipboard".into()) // 网页URL，传递查询参数指示是浮动窗口
    )
    .title("Copy2AI智能剪切板 V0.1-beta (体验版)")
    .inner_size(400.0, 600.0)
    .min_inner_size(300.0, 400.0)
    .resizable(true)
    .decorations(true)
    .always_on_top(true)
    .center();
    
    match builder.build() {
        Ok(window) => {
            // println!("浮动剪贴板窗口创建成功");
            // 确保窗口显示并聚焦
            let _ = window.show();
            let _ = window.set_focus();
        },
        Err(_e) => {} // eprintln!("浮动剪贴板窗口创建失败: {}", e)
    }
}

// 更新快捷键
#[tauri::command]
fn update_shortcut(old_shortcut: String, new_shortcut: String, _window_label: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    // println!("更新快捷键: {} -> {} (窗口: {})", old_shortcut, new_shortcut, window_label);
    
    let shortcut_manager = app_handle.global_shortcut();
    
    // 先检查旧快捷键是否已注册
    if shortcut_manager.is_registered(old_shortcut.as_str()) {
        // 如果已注册，则取消注册
        match shortcut_manager.unregister(old_shortcut.as_str()) {
            Ok(_) => {}, // println!("成功取消旧快捷键注册: {}", old_shortcut),
            Err(e) => {
                let error_msg = format!("取消旧快捷键注册失败: {}", e);
                // eprintln!("{}", error_msg);
                return Err(error_msg);
            }
        }
    } else {
        // println!("旧快捷键 {} 未注册，无需取消", old_shortcut);
    }
    
    // 检查新快捷键是否已注册
    if shortcut_manager.is_registered(new_shortcut.as_str()) {
        match shortcut_manager.unregister(new_shortcut.as_str()) {
            Ok(_) => {}, // println!("新快捷键已存在，已取消现有注册: {}", new_shortcut),
            Err(e) => {
                let error_msg = format!("取消现有新快捷键注册失败: {}", e);
                // eprintln!("{}", error_msg);
                return Err(error_msg);
            }
        }
    }
    
    // 注册新快捷键 - Tauri v2 方式只注册快捷键，通过事件处理回调
    match shortcut_manager.register(new_shortcut.as_str()) {
        Ok(_) => {
            // println!("成功注册新快捷键: {}", new_shortcut);
            
            // 存储快捷键与窗口的映射关系，方便在事件处理中使用
            // 这里可以实现一个简单的内存映射或配置文件存储来记录这种关联
            // 实际实现中，可以考虑使用全局状态或专门的配置管理
            // println!("已将快捷键 {} 与窗口 {} 关联", new_shortcut, window_label);
            
            Ok(())
        },
        Err(e) => {
            let error_msg = format!("注册新快捷键失败: {}", e);
            // eprintln!("{}", error_msg);
            Err(error_msg)
        }
    }
}

// 获取剪贴板历史
#[tauri::command]
fn get_clipboard_history(
    state: State<AppState>,
    limit: Option<usize>,
    offset: Option<usize>,
    filter_options: Option<serde_json::Value>
) -> Result<Vec<ClipboardItem>, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    
    // 如果没有提供分页参数和过滤条件，则返回所有数据
    if limit.is_none() && offset.is_none() && filter_options.is_none() {
        return Ok(storage.get_all_items());
    }
    
    // 解析过滤器
    let filter = filter_options.and_then(|filter_value| {
        serde_json::from_value::<ClipboardFilter>(filter_value).ok()
    });
    
    // 使用新的分页过滤方法
    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(storage.get_filtered_count(filter.as_ref()));
    
    Ok(storage.get_filtered_paged_items(filter.as_ref(), offset, limit))
}

// 获取符合条件的剪贴板记录总数
#[tauri::command]
fn get_clipboard_count(
    state: State<AppState>,
    filter_options: Option<serde_json::Value>
) -> Result<usize, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    
    // 解析过滤器
    let filter = filter_options.and_then(|filter_value| {
        serde_json::from_value::<ClipboardFilter>(filter_value).ok()
    });
    
    Ok(storage.get_filtered_count(filter.as_ref()))
}

// 添加剪贴板条目
#[tauri::command]
fn add_clipboard_item(item: ClipboardItem, state: State<AppState>) -> ClipboardOperationResult {
    let mut storage = state.storage.lock().map_err(|e| e.to_string()).unwrap();
    
    match storage.add_item(item) {
        Ok(_) => ClipboardOperationResult {
            success: true,
            message: Some("添加成功".to_string()),
            data: None,
        },
        Err(e) => ClipboardOperationResult {
            success: false,
            message: Some(format!("添加失败: {}", e)),
            data: None,
        }
    }
}

// 删除剪贴板条目
#[tauri::command]
fn remove_clipboard_item(id: String, state: State<AppState>) -> ClipboardOperationResult {
    let mut storage = state.storage.lock().map_err(|e| e.to_string()).unwrap();
    
    match storage.remove_item(&id) {
        Ok(_) => ClipboardOperationResult {
            success: true,
            message: Some("删除成功".to_string()),
            data: None,
        },
        Err(e) => ClipboardOperationResult {
            success: false,
            message: Some(format!("删除失败: {}", e)),
            data: None,
        }
    }
}

// 更新剪贴板条目
#[tauri::command]
fn update_clipboard_item(item: ClipboardItem, state: State<AppState>) -> ClipboardOperationResult {
    let mut storage = state.storage.lock().map_err(|e| e.to_string()).unwrap();
    
    match storage.update_item(item) {
        Ok(_) => ClipboardOperationResult {
            success: true,
            message: Some("更新成功".to_string()),
            data: None,
        },
        Err(e) => ClipboardOperationResult {
            success: false,
            message: Some(format!("更新失败: {}", e)),
            data: None,
        }
    }
}

// 复制内容到系统剪贴板
#[tauri::command]
async fn copy_to_clipboard(content: String, app_handle: tauri::AppHandle) -> ClipboardOperationResult {
    let manager = app_handle.clipboard();
    match manager.write_text(content) {
        Ok(_) => ClipboardOperationResult {
            success: true,
            message: Some("复制成功".to_string()),
            data: None,
        },
        Err(e) => ClipboardOperationResult {
            success: false,
            message: Some(format!("复制失败: {}", e)),
            data: None,
        }
    }
}

// 清空剪贴板历史
#[tauri::command]
fn clear_clipboard_history(state: State<AppState>) -> ClipboardOperationResult {
    let mut storage = state.storage.lock().map_err(|e| e.to_string()).unwrap();
    
    match storage.clear_all() {
        Ok(_) => ClipboardOperationResult {
            success: true,
            message: Some("清空成功".to_string()),
            data: None,
        },
        Err(e) => ClipboardOperationResult {
            success: false,
            message: Some(format!("清空失败: {}", e)),
            data: None,
        }
    }
}

// 翻译内容
#[tauri::command]
async fn translate_content(_id: String, content: String) -> ClipboardOperationResult {
    // 模拟实现
    ClipboardOperationResult {
        success: true,
        message: Some("翻译成功".to_string()),
        data: Some(serde_json::json!({
            "translation": format!("这是 {} 的翻译结果", content)
        })),
    }
}

// 总结内容
#[tauri::command]
async fn summarize_content(_id: String, content: String) -> ClipboardOperationResult {
    // 模拟实现
    ClipboardOperationResult {
        success: true,
        message: Some("总结成功".to_string()),
        data: Some(serde_json::json!({
            "summary": format!("这是 {} 的总结内容", content)
        })),
    }
}

// AI分析功能
#[tauri::command]
async fn analyze_with_ai(
    content: String, 
    system_prompt: String, 
    _provider_id: Option<String>, 
    api_key: Option<String>, 
    api_base_url: Option<String>, 
    model: Option<String>
) -> Result<String, String> {
    // println!("开始AI分析...");
    
    // 如果未提供提供商参数，尝试从环境变量获取
    let actual_api_key = match api_key {
        Some(key) if !key.is_empty() => key,
        _ => match std::env::var("OPENAI_API_KEY") {
            Ok(key) => key,
            Err(_) => return Err("未提供API密钥且环境变量OPENAI_API_KEY未设置".to_string()),
        },
    };
    
    let actual_api_base_url = match api_base_url {
        Some(url) if !url.is_empty() => url,
        _ => "https://api.openai.com/v1".to_string(),
    };
    
    let actual_model = match model {
        Some(m) if !m.is_empty() => m,
        _ => "gpt-3.5-turbo".to_string(),
    };
    
    // println!("使用参数: 基础URL: {}, 模型: {}", actual_api_base_url, actual_model);
    
    // 构建API请求
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", actual_api_base_url))
        .header("Authorization", format!("Bearer {}", actual_api_key))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "model": actual_model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": content
                }
            ],
            "temperature": 0.7,
            "max_tokens": 1000
        }))
        .send()
        .await;
    
    match response {
        Ok(res) => {
            if res.status().is_success() {
                match res.json::<serde_json::Value>().await {
                    Ok(json) => {
                        // 从响应中提取内容
                        let result = json["choices"][0]["message"]["content"]
                            .as_str()
                            .unwrap_or("无法解析结果")
                            .to_string();
                        
                        // println!("AI分析完成");
                        Ok(result)
                    }
                    Err(e) => Err(format!("解析响应失败: {}", e)),
                }
            } else {
                let status = res.status();
                match res.text().await {
                    Ok(error_text) => Err(format!("API请求失败 ({}): {}", status, error_text)),
                    Err(_) => Err(format!("API请求失败1: 状态码 {}", status)),
                }
            }
        }
        Err(e) => Err(format!("请求失败: {}", e)),
    }
}

// 获取所有AI角色
#[tauri::command]
fn get_ai_roles(state: State<AppState>) -> Result<Vec<AIRole>, String> {
    let ai_manager = state.ai_manager.lock().map_err(|e| e.to_string())?;
    ai_manager.get_all_roles()
}

// 添加AI角色
#[tauri::command]
fn add_ai_role(role: AIRole, state: State<AppState>) -> Result<(), String> {
    let ai_manager = state.ai_manager.lock().map_err(|e| e.to_string())?;
    ai_manager.add_role(role)
}

// 更新AI角色
#[tauri::command]
fn update_ai_role(role: AIRole, state: State<AppState>) -> Result<(), String> {
    let ai_manager = state.ai_manager.lock().map_err(|e| e.to_string())?;
    ai_manager.update_role(role)
}

// 删除AI角色
#[tauri::command]
fn delete_ai_role(id: String, state: State<AppState>) -> Result<(), String> {
    let ai_manager = state.ai_manager.lock().map_err(|e| e.to_string())?;
    ai_manager.delete_role(&id)
}

// 获取AI配置
#[tauri::command]
fn get_ai_config(state: State<AppState>) -> Result<AIConfig, String> {
    let ai_manager = state.ai_manager.lock().map_err(|e| e.to_string())?;
    ai_manager.get_config()
}

// 更新AI配置
#[tauri::command]
fn update_ai_config(config: AIConfig, state: State<AppState>) -> Result<(), String> {
    let ai_manager = state.ai_manager.lock().map_err(|e| e.to_string())?;
    ai_manager.update_config(config)
}

// 编辑剪贴板条目内容
#[tauri::command]
fn edit_clipboard_item(id: String, new_content: String, state: State<AppState>) -> ClipboardOperationResult {
    // println!("尝试编辑剪贴板条目: {}", id);
    
    match state.storage.lock() {
        Ok(mut storage) => {
            // 获取原始条目
            let existing_item = match storage.get_item(&id) {
                Some(item) => item.clone(),
                None => return ClipboardOperationResult {
                    success: false,
                    message: Some(String::from("找不到指定的剪贴板条目")),
                    data: None,
                },
            };
            
            // 创建更新后的条目
            let updated_item = ClipboardItem {
                id: existing_item.id, // 保持ID不变
                content: new_content,
                timestamp: existing_item.timestamp, // 保持时间戳不变
                favorite: existing_item.favorite,
                pinned: existing_item.pinned,
                category: existing_item.category,
                translation: None, // 清除翻译，因为内容已更改
                summary: None, // 清除摘要，因为内容已更改
                ai_analysis_count: existing_item.ai_analysis_count, // 保持AI分析次数不变
            };
            
            // 更新条目
            match storage.update_item(updated_item) {
                Ok(_) => ClipboardOperationResult {
                    success: true,
                    message: None,
                    data: None,
                },
                Err(e) => ClipboardOperationResult {
                    success: false,
                    message: Some(format!("更新剪贴板条目失败: {}", e)),
                    data: None,
                },
            }
        },
        Err(e) => ClipboardOperationResult {
            success: false,
            message: Some(format!("获取存储锁失败: {}", e)),
            data: None,
        },
    }
}

// 获取所有角色
#[tauri::command]
fn get_roles(state: State<AppState>) -> Result<Vec<Role>, String> {
    let role_storage = state.role_storage.lock().map_err(|e| e.to_string())?;
    Ok(role_storage.get_all_roles())
}

// 添加角色
#[tauri::command]
fn add_role(
    name: String, 
    description: String, 
    systemPrompt: String, 
    icon: String, 
    isCustom: bool, 
    avatar: Option<String>,
    state: State<AppState>
) -> RoleOperationResult {
    // println!("添加角色: {}", name);
    
    let mut role_storage = state.role_storage.lock().map_err(|e| e.to_string()).unwrap();
    
    // 创建角色对象
    let now = chrono::Utc::now().timestamp_millis() as u64;
    let role = Role {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        description,
        system_prompt: systemPrompt,
        icon,
        avatar,
        is_custom: isCustom,
        created_at: now,
        updated_at: now,
    };
    
    match role_storage.add_role(role) {
        Ok(_) => RoleOperationResult {
            success: true,
            message: Some("添加角色成功".to_string()),
            data: None,
        },
        Err(e) => RoleOperationResult {
            success: false,
            message: Some(format!("添加角色失败: {}", e)),
            data: None,
        }
    }
}

// 更新角色
#[tauri::command]
fn update_role(role: Role, state: State<AppState>) -> RoleOperationResult {
    // println!("更新角色: {:?}", role);
    let mut role_storage = state.role_storage.lock().map_err(|e| e.to_string()).unwrap();
    
    match role_storage.update_role(role) {
        Ok(_) => RoleOperationResult {
            success: true,
            message: Some("更新角色成功".to_string()),
            data: None,
        },
        Err(e) => RoleOperationResult {
            success: false,
            message: Some(format!("更新角色失败: {}", e)),
            data: None,
        }
    }
}

// 删除角色
#[tauri::command]
fn delete_role(id: String, state: State<AppState>) -> RoleOperationResult {
    let mut role_storage = state.role_storage.lock().map_err(|e| e.to_string()).unwrap();
    
    match role_storage.delete_role(&id) {
        Ok(_) => RoleOperationResult {
            success: true,
            message: Some("删除角色成功".to_string()),
            data: None,
        },
        Err(e) => RoleOperationResult {
            success: false,
            message: Some(format!("删除角色失败: {}", e)),
            data: None,
        }
    }
}

// 重置角色
#[tauri::command]
fn reset_role(id: String, state: State<AppState>) -> RoleOperationResult {
    let mut role_storage = state.role_storage.lock().map_err(|e| e.to_string()).unwrap();
    
    match role_storage.reset_role(&id) {
        Ok(_) => RoleOperationResult {
            success: true,
            message: Some("重置角色成功".to_string()),
            data: None,
        },
        Err(e) => RoleOperationResult {
            success: false,
            message: Some(format!("重置角色失败: {}", e)),
            data: None,
        }
    }
}

// 获取AI设置
#[tauri::command]
fn get_ai_settings(state: State<AppState>) -> Result<AISettings, String> {
    let ai_settings_manager = state.ai_settings_manager.lock().map_err(|e| e.to_string())?;
    ai_settings_manager.get_settings()
}

// 更新AI设置
#[tauri::command]
fn update_ai_settings(settings: AISettings, state: State<AppState>) -> Result<(), String> {
    let ai_settings_manager = state.ai_settings_manager.lock().map_err(|e| e.to_string())?;
    ai_settings_manager.update_settings(settings)
}

// 获取提供商设置
#[tauri::command]
fn get_provider_setting(provider_id: String, state: State<AppState>) -> Result<AIProviderSetting, String> {
    let ai_settings_manager = state.ai_settings_manager.lock().map_err(|e| e.to_string())?;
    ai_settings_manager.get_provider_setting(&provider_id)
}

// 更新提供商设置
#[tauri::command]
fn update_provider_setting(provider_id: String, setting: AIProviderSetting, state: State<AppState>) -> Result<(), String> {
    let ai_settings_manager = state.ai_settings_manager.lock().map_err(|e| e.to_string())?;
    ai_settings_manager.update_provider_setting(&provider_id, setting)
}

// 获取模型列表
#[tauri::command]
async fn fetch_models(url: String, api_key: Option<String>, api_base_url: Option<String>) -> Result<Vec<ModelInfo>, String> {
    // println!("尝试从 {} 获取模型列表", url);
    
    let is_local_service = url.contains("localhost") || url.contains("127.0.0.1");
    let is_ollama = url.contains("open.bigmodel.cn/api/paas/v4");
    
    // 构建客户端
    let client = reqwest::Client::new();
    let mut request = client.get(&url);
    
    // 只有非本地服务才验证API密钥
    if !is_local_service {
        // 验证API密钥
        let api_key_str = match &api_key {
            Some(ref key) if !key.trim().is_empty() => key,
            _ => return Err("API密钥不能为空".into()),
        };
        
        request = request.header("Authorization", format!("Bearer {}", api_key_str));
    } else if let Some(ref key) = api_key {
        // 如果是本地服务且提供了API密钥，也添加
        if !key.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", key));
        }
    }
    
    // 添加通用头部
    request = request.header("Content-Type", "application/json");
    
    // 发送请求获取模型列表
    let response = request
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    // 检查响应状态
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| "无法读取响应内容".to_string());
        
        // 如果是Ollama且报404错误，尝试使用原始API
        if is_ollama && status.as_u16() == 404 {
            // println!("Ollama 404错误，尝试使用原始API...");
            return fetch_ollama_fallback(api_base_url.unwrap_or(url), api_key).await;
        }
        
        return Err(format!("API请求失败2: 状态码 {}, 错误信息: {}", status, body));
    }
    
    // 解析响应
    let body = response.text().await
        .map_err(|e| format!("读取响应失败: {}", e))?;
    
    // println!("收到响应: {}", body);
    
    // 尝试解析为标准OpenAI响应格式
    let parsed_response: Result<serde_json::Value, _> = serde_json::from_str(&body);
    
    match parsed_response {
        Ok(json) => {
            // 尝试标准OpenAI格式解析
            if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                // OpenAI格式的模型列表
                let models = data.iter()
                    .filter_map(|model| {
                        let id = model.get("id")?.as_str()?.to_string();
                        
                        Some(ModelInfo {
                            id: id.clone(),
                            name: Some(id),
                            description: None,
                            max_tokens: None,
                        })
                    })
                    .collect::<Vec<_>>();
                
                if !models.is_empty() {
                    // println!("成功解析 {} 个模型 (OpenAI格式)", models.len());
                    return Ok(models);
                }
            }
            
            // 检查是否是其他格式的响应
            if let Some(models_array) = json.get("models").and_then(|m| m.as_array()) {
                // 可能是非标准格式的响应
                let models = models_array.iter()
                    .filter_map(|model| {
                        let id = if let Some(id) = model.get("id").and_then(|i| i.as_str()) {
                            id.to_string()
                        } else if let Some(id) = model.get("name").and_then(|i| i.as_str()) {
                            id.to_string()
                        } else {
                            return None;
                        };
                        
                        let name = model.get("name").and_then(|n| n.as_str()).map(String::from);
                        let description = model.get("description").and_then(|d| d.as_str()).map(String::from);
                        let max_tokens = model.get("max_tokens").and_then(|t| t.as_u64()).map(|t| t as u32);
                        
                        Some(ModelInfo {
                            id,
                            name,
                            description,
                            max_tokens,
                        })
                    })
                    .collect::<Vec<_>>();
                
                if !models.is_empty() {
                    // println!("成功解析 {} 个模型 (非标准格式)", models.len());
                    return Ok(models);
                }
            }
            
            // 直接检查是否是数组
            if let Some(models_array) = json.as_array() {
                let models = models_array.iter()
                    .filter_map(|model| {
                        let id = if let Some(id) = model.get("id").and_then(|i| i.as_str()) {
                            id.to_string()
                        } else if let Some(id) = model.get("name").and_then(|i| i.as_str()) {
                            id.to_string()
                        } else {
                            return None;
                        };
                        
                        Some(ModelInfo {
                            id,
                            name: None,
                            description: None,
                            max_tokens: None,
                        })
                    })
                    .collect::<Vec<_>>();
                
                if !models.is_empty() {
                    // println!("成功解析 {} 个模型 (数组格式)", models.len());
                    return Ok(models);
                }
            }
            
            // 没有找到可识别的模型格式，如果是Ollama尝试使用原始API
            if is_ollama {
                // println!("无法识别的响应格式，尝试Ollama原始API...");
                return fetch_ollama_fallback(api_base_url.unwrap_or(url), api_key).await;
            }
            
            // 没有找到可识别的模型格式
            Err(format!("无法识别的模型列表格式: {}", body))
        }
        Err(e) => {
            // 如果是本地服务(如Ollama)，尝试解析其特定格式
            if is_local_service {
                if is_ollama {
                    // 尝试解析Ollama标签格式
                    match parse_ollama_response(&body) {
                        Ok(models) => return Ok(models),
                        Err(_e) => {
                            // println!("解析Ollama响应失败: {}", e);
                            
                            // 再尝试原始API
                            return fetch_ollama_fallback(api_base_url.unwrap_or(url), api_key).await;
                        },
                    }
                }
            }
            
            Err(format!("解析响应失败: {}, 响应内容: {}", e, body))
        }
    }
}

// 使用Ollama原始API获取模型
async fn fetch_ollama_fallback(api_base_url: String, api_key: Option<String>) -> Result<Vec<ModelInfo>, String> {
    // println!("尝试使用Ollama原始API获取模型");
    
    // 转换URL为原始API路径
    let base_url = if api_base_url.contains("/v1") {
        api_base_url.replace("/v1", "/api")
    } else {
        if !api_base_url.contains("/api") {
            format!("{}/api", api_base_url.trim_end_matches('/'))
        } else {
            api_base_url
        }
    };
    
    let url = format!("{}/tags", base_url);
    // println!("尝试从 {} 获取Ollama模型列表", url);
    
    let client = reqwest::Client::new();
    let mut request = client.get(&url)
        .header("Content-Type", "application/json");
    
    // 添加认证头（如果提供了API密钥）
    if let Some(key) = &api_key {
        if !key.trim().is_empty() {
            // println!("添加模型获取认证头: Bearer {}", key.chars().take(5).collect::<String>() + "...");
            request = request.header("Authorization", format!("Bearer {}", key));
        }
    }
    
    let response = request.send().await
        .map_err(|e| format!("请求Ollama原始API失败: {}", e))?;
    
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_else(|_| "无法读取响应内容".to_string());
        return Err(format!("Ollama API请求失败: 状态码 {}, 错误信息: {}", status, body));
    }
    
    let body = response.text().await
        .map_err(|e| format!("读取Ollama响应失败: {}", e))?;
    
    // println!("收到Ollama响应: {}", body);
    
    parse_ollama_response(&body)
}

// 解析Ollama响应
fn parse_ollama_response(body: &str) -> Result<Vec<ModelInfo>, String> {
    #[derive(serde::Deserialize)]
    struct OllamaModel {
        name: String,
        #[serde(default)]
        size: Option<u64>,
    }
    
    #[derive(serde::Deserialize)]
    struct OllamaResponse {
        models: Vec<OllamaModel>,
    }
    
    match serde_json::from_str::<OllamaResponse>(body) {
        Ok(response) => {
            let models = response.models.into_iter()
                .map(|model| ModelInfo {
                    id: model.name.clone(),
                    name: Some(model.name),
                    description: None,
                    max_tokens: None,
                })
                .collect();
            Ok(models)
        },
        Err(_) => {
            // 尝试解析为简单的模型数组
            match serde_json::from_str::<Vec<OllamaModel>>(body) {
                Ok(models) => {
                    let models = models.into_iter()
                        .map(|model| ModelInfo {
                            id: model.name.clone(),
                            name: Some(model.name),
                            description: None,
                            max_tokens: None,
                        })
                        .collect();
                    Ok(models)
                }
                Err(e) => Err(format!("解析Ollama响应失败: {}", e)),
            }
        }
    }
}

// 测试API连接
#[tauri::command]
async fn test_api_connection(api_base_url: String, api_key: Option<String>, _model: String) -> Result<APITestResult, String> {
    // println!("测试API连接: {}", api_base_url);
    
    let is_local_service = api_base_url.contains("localhost") || api_base_url.contains("127.0.0.1");
    let is_ollama = api_base_url.contains("open.bigmodel.cn/api/paas/v4");
    
    // 构建客户端
    let client = reqwest::Client::new();
    
    // 开始计时
    let start_time = std::time::Instant::now();
    
    // 构建测试请求URL
    let test_url = if is_ollama {
        // Ollama特殊处理，确保使用正确的API端点
        // 尝试/v1/models而不是/models
        format!("{}/", api_base_url)
    } else {
        format!("{}/models", api_base_url)
    };
    
    // println!("测试URL: {}", test_url);
    
    // 发送请求
    let mut request = client.get(&test_url);
    
    // 只有非本地服务才强制验证API密钥
    if !is_local_service {
        let api_key = match &api_key {
            Some(ref key) if !key.trim().is_empty() => key,
            _ => return Err("API密钥不能为空".into()),
        };
        
        request = request.header("Authorization", format!("Bearer {}", api_key));
    } else if let Some(ref key) = api_key {
        // 如果是本地服务且提供了API密钥，也添加
        if !key.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", key));
        }
    }
    
    // 添加通用头部
    request = request.header("Content-Type", "application/json");
    
    let response = request.send().await;
    
    // 计算响应时间
    let response_time = start_time.elapsed().as_millis() as u64;
    
    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                // 尝试读取响应内容，验证是否包含模型列表
                match resp.text().await {
                    Ok(text) => {
                        // 简单检查是否包含模型列表相关关键字
                        let contains_models = text.contains("models") || text.contains("data") || text.contains("id");
                        
                        if contains_models {
                            Ok(APITestResult {
                                success: true,
                                message: format!("连接成功，已获取模型列表 ({}ms)", response_time),
                                response_time: Some(response_time),
                            })
                        } else {
                            Ok(APITestResult {
                                success: true,
                                message: format!("连接成功，但无法确认是否为有效的模型列表接口 ({}ms)", response_time),
                                response_time: Some(response_time),
                            })
                        }
                    }
                    Err(_) => {
                        Ok(APITestResult {
                            success: true,
                            message: format!("连接成功 ({}ms)", response_time),
                            response_time: Some(response_time),
                        })
                    }
                }
            } else {
                let status = resp.status();
                let error_text = resp.text().await.unwrap_or_else(|_| "无法读取错误详情".to_string());
                
                // 如果是Ollama且报404，尝试回退到原始API端点
                if is_ollama && status.as_u16() == 404 {
                    // println!("Ollama 404错误，尝试备用端点...");
                    return test_ollama_fallback(api_base_url, api_key, _model).await;
                }
                
                Ok(APITestResult {
                    success: false,
                    message: format!("API请求失败: 状态码 {}, 错误信息: {}", status, error_text),
                    response_time: Some(response_time),
                })
            }
        }
        Err(e) => {
            // 如果是Ollama且连接失败，尝试回退到原始API端点
            if is_ollama {
                // println!("Ollama连接失败，尝试备用端点...");
                return test_ollama_fallback(api_base_url, api_key, _model).await;
            }
            
            Ok(APITestResult {
                success: false,
                message: format!("连接失败: {}", e),
                response_time: Some(response_time),
            })
        }
    }
}

// Ollama备用测试方法，尝试原始API端点
async fn test_ollama_fallback(api_base_url: String, api_key: Option<String>, _model: String) -> Result<APITestResult, String> {
    // println!("尝试Ollama备用API端点");
    
    // 构建备用URL，使用原始API端点
    let base_url = api_base_url.replace("/v1", "/api");
    let test_url = format!("{}/chat/completions", base_url);
    
    // println!("备用测试URL: {}", test_url);
    
    // 开始计时
    let start_time = std::time::Instant::now();
    
    // 发送请求
    let client = reqwest::Client::new();
    let mut request = client.get(&test_url)
        .header("Content-Type", "application/json");
    
    // 添加认证头（如果提供了API密钥）
    if let Some(key) = &api_key {
        if !key.trim().is_empty() {
            // println!("添加备用端点授权头: Bearer {}", key.chars().take(5).collect::<String>() + "...");
            request = request.header("Authorization", format!("Bearer {}", key));
        }
    }
    
    let response = request.send().await;
    
    // 计算响应时间
    let response_time = start_time.elapsed().as_millis() as u64;
    
    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                match resp.text().await {
                    Ok(text) => {
                        if text.contains("models") || text.contains("name") {
                            Ok(APITestResult {
                                success: true,
                                message: format!("连接成功 (使用备用API端点) ({}ms)", response_time),
                                response_time: Some(response_time),
                            })
                        } else {
                            Ok(APITestResult {
                                success: true,
                                message: format!("连接成功，但响应格式可能不正确 ({}ms)", response_time),
                                response_time: Some(response_time),
                            })
                        }
                    }
                    Err(_) => {
                        Ok(APITestResult {
                            success: true,
                            message: format!("连接成功 (使用备用API端点) ({}ms)", response_time),
                            response_time: Some(response_time),
                        })
                    }
                }
            } else {
                let status = resp.status();
                let error_text = resp.text().await.unwrap_or_else(|_| "无法读取错误详情".to_string());
                Ok(APITestResult {
                    success: false,
                    message: format!("API请求失败 (备用端点): 状态码 {}, 错误信息: {}", status, error_text),
                    response_time: Some(response_time),
                })
            }
        }
        Err(e) => {
            Ok(APITestResult {
                success: false,
                message: format!("连接备用端点失败: {}。请检查Ollama是否正在运行", e),
                response_time: Some(response_time),
            })
        }
    }
}

#[tauri::command]
async fn chat_with_ai(
    messages: Vec<serde_json::Value>,
    model: String,
    temperature: f32,
    max_tokens: u32,
    stream: bool,
    _provider_id: String,
    api_key: String,
    api_base_url: String
) -> Result<serde_json::Value, String> {
    // println!("开始发送聊天请求...");
    // println!("提供商: {}, 模型: {}, 流式输出: {}", provider_id, model, stream);
    
    // 构建请求体
    let request_body = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream
    });
    
    let client = reqwest::Client::new();
    let response = client
        .post(format!("{}/chat/completions", api_base_url))
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&request_body)
        .send()
        .await;
    
    match response {
        Ok(res) => {
            if res.status().is_success() {
                match res.json::<serde_json::Value>().await {
                    Ok(json) => {
                        // println!("AI响应成功");
                        Ok(json)
                    }
                    Err(e) => Err(format!("解析响应失败: {}", e)),
                }
            } else {
                let status = res.status();
                match res.text().await {
                    Ok(error_text) => Err(format!("API请求失败 ({}): {}", status, error_text)),
                    Err(_) => Err(format!("API请求失败: 状态码 {}", status)),
                }
            }
        }
        Err(e) => Err(format!("请求失败: {}", e)),
    }
}

#[tauri::command]
fn get_role(id: String, state: State<AppState>) -> Result<Role, String> {
    let role_storage = state.role_storage.lock().map_err(|e| e.to_string())?;
    role_storage.get_role(&id).ok_or_else(|| format!("未找到角色: {}", id)).cloned()
}

#[tauri::command]
async fn get_ai_models(provider_id: String, state: State<'_, AppState>) -> Result<Vec<ModelInfo>, String> {
    // println!("获取AI模型列表: {}", provider_id);
    
    // 获取提供商设置 - 修改代码确保锁在await前释放
    let provider_setting = {
        let ai_settings_manager = state.ai_settings_manager.lock().map_err(|e| e.to_string())?;
        ai_settings_manager.get_provider_setting(&provider_id)?
    };
    
    let api_key = provider_setting.api_key;
    let api_base_url = provider_setting.custom_api_base_url.unwrap_or_else(|| {
        // 根据提供商提供默认URL
        match provider_id.as_str() {
            "OpenAI" => "https://api.openai.com/v1".to_string(),
            "Ollama" => "http://localhost:11434".to_string(),
            "ZhipuAI" => "https://open.bigmodel.cn/api/paas/v4".to_string(),
            "Copy2AI" => "https://api.copy2ai.com/v1".to_string(),
            _ => "https://api.openai.com/v1".to_string(),
        }
    });
    
    if provider_id == "Ollama" {
        // Ollama特殊处理
        return fetch_ollama_fallback(api_base_url, api_key).await;
    } else if provider_id == "OpenAI" {
        // 标准OpenAI API
        let url = format!("{}/models", api_base_url);
        return fetch_models(url, api_key, Some(api_base_url)).await;
    } else if provider_id == "ZhipuAI" {
        // 智普AI特殊处理
        return fetch_ollama_fallback(api_base_url, api_key).await;
    } else if provider_id == "Copy2AI" {
        // 兼容性处理，自建服务
        let url = format!("{}/models", api_base_url);
        return fetch_models(url, api_key, Some(api_base_url)).await;
    } else {
        // 通用处理
        let url = format!("{}/models", api_base_url);
        return fetch_models(url, api_key, Some(api_base_url)).await;
    }
}

// 获取系统信息
#[tauri::command]
async fn get_system_info() -> Result<serde_json::Value, String> {
    // 获取操作系统信息
    let os_type = tauri_plugin_os::type_().to_string();
    let os_version = tauri_plugin_os::version();
    
    // 获取系统信息（使用sysinfo库）
    let mut sys = System::new_all();
    sys.refresh_all();
    
    // 计算内存使用率
    let memory_total = sys.total_memory();
    let memory_used = memory_total - sys.available_memory();
    let memory_usage = ((memory_used as f64 / memory_total as f64) * 100.0).round() as u64;
    
    // 计算CPU使用率
    let cpu_usage = sys.global_cpu_info().cpu_usage() as f64;
    
    // 系统启动时间和运行时间
    let uptime = sys.uptime();
    let boot_time = chrono::Utc::now().timestamp() as u64 - uptime;
    
    // 返回结果
    let result = serde_json::json!({
        "os": os_type,
        "version": os_version,
        "memoryUsage": memory_usage,
        "cpuUsage": cpu_usage,
        "startTime": boot_time,
        "uptime": uptime,
        "memoryTotal": memory_total,
        "memoryFree": sys.available_memory(),
        "memoryUsed": memory_used
    });
    
    Ok(result)
} 