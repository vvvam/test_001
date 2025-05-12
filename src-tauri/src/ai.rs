use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::path::PathBuf;
use std::fs;
use reqwest;
use tokio::io::AsyncRead;
use uuid;
use encoding_rs;
use tauri::Window;
use tauri::State;
use std::time::Instant;
use tauri::{AppHandle, Manager, Emitter};
use tokio::io::AsyncReadExt;
use futures_util::{StreamExt, TryStreamExt};
use tokio_util::io::StreamReader;
use reqwest::Body;
use futures::stream::{self, Stream};
use std::sync::Arc;
use serde_json::Value;
use std::io;

// 在ai.rs中定义AppState结构体类型别名，指向main.rs中的AppState
// 必须在同一文件中实现，否则需要导出
type AppState = crate::AppState;

/// AI角色定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIRole {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub icon: String,
    pub category: String,
    pub is_default: Option<bool>,
}

/// AI配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub api_key: Option<String>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
}

/// AI管理器
pub struct AIManager {
    roles: Mutex<Vec<AIRole>>,
    config: Mutex<AIConfig>,
    roles_file: PathBuf,
    config_file: PathBuf,
}

impl AIManager {
    /// 创建新的AI管理器
    pub fn new(data_dir: PathBuf) -> Self {
        let roles_file = data_dir.join("ai_roles.json");
        let config_file = data_dir.join("ai_config.json");
        
        // 尝试加载角色和配置
        let roles = Self::load_roles_from_file(&roles_file).unwrap_or_else(|_| Vec::new());
        let config = Self::load_config_from_file(&config_file).unwrap_or_else(|_| AIConfig {
            api_key: None,
            model: "gpt-3.5-turbo".to_string(),
            temperature: 0.7,
            max_tokens: 1000,
        });
        
        Self {
            roles: Mutex::new(roles),
            config: Mutex::new(config),
            roles_file,
            config_file,
        }
    }
    
    /// 从文件加载角色
    fn load_roles_from_file(file_path: &PathBuf) -> Result<Vec<AIRole>, String> {
        if !file_path.exists() {
            return Ok(Vec::new());
        }
        
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("读取角色文件失败: {}", e))?;
            
        serde_json::from_str(&content)
            .map_err(|e| format!("解析角色JSON失败: {}", e))
    }
    
    /// 保存角色到文件
    fn save_roles_to_file(&self) -> Result<(), String> {
        let roles = self.roles.lock()
            .map_err(|e| format!("获取角色数据失败: {}", e))?;
            
        let content = serde_json::to_string_pretty(&*roles)
            .map_err(|e| format!("序列化角色数据失败: {}", e))?;
            
        fs::write(&self.roles_file, content)
            .map_err(|e| format!("写入角色文件失败: {}", e))
    }
    
    /// 从文件加载配置
    fn load_config_from_file(file_path: &PathBuf) -> Result<AIConfig, String> {
        if !file_path.exists() {
            return Err("配置文件不存在".to_string());
        }
        
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("读取配置文件失败: {}", e))?;
            
        serde_json::from_str(&content)
            .map_err(|e| format!("解析配置JSON失败: {}", e))
    }
    
    /// 保存配置到文件
    fn save_config_to_file(&self) -> Result<(), String> {
        let config = self.config.lock()
            .map_err(|e| format!("获取配置数据失败: {}", e))?;
            
        let content = serde_json::to_string_pretty(&*config)
            .map_err(|e| format!("序列化配置数据失败: {}", e))?;
            
        fs::write(&self.config_file, content)
            .map_err(|e| format!("写入配置文件失败: {}", e))
    }
    
    /// 获取所有角色
    pub fn get_all_roles(&self) -> Result<Vec<AIRole>, String> {
        let roles = self.roles.lock()
            .map_err(|e| format!("获取角色数据失败: {}", e))?;
            
        Ok(roles.clone())
    }
    
    /// 添加角色
    pub fn add_role(&self, role: AIRole) -> Result<(), String> {
        let mut roles = self.roles.lock()
            .map_err(|e| format!("获取角色数据失败: {}", e))?;
            
        // 检查ID是否已存在
        if roles.iter().any(|r| r.id == role.id) {
            return Err(format!("角色ID '{}'已存在", role.id));
        }
        
        roles.push(role);
        self.save_roles_to_file()
    }
    
    /// 更新角色
    pub fn update_role(&self, updated_role: AIRole) -> Result<(), String> {
        let mut roles = self.roles.lock()
            .map_err(|e| format!("获取角色数据失败: {}", e))?;
            
        let index = roles.iter().position(|r| r.id == updated_role.id)
            .ok_or_else(|| format!("未找到角色ID '{}'", updated_role.id))?;
            
        roles[index] = updated_role;
        self.save_roles_to_file()
    }
    
    /// 删除角色
    pub fn delete_role(&self, id: &str) -> Result<(), String> {
        let mut roles = self.roles.lock()
            .map_err(|e| format!("获取角色数据失败: {}", e))?;
            
        let index = roles.iter().position(|r| r.id == id)
            .ok_or_else(|| format!("未找到角色ID '{}'", id))?;
            
        // 检查是否为默认角色
        if let Some(true) = roles[index].is_default {
            return Err("不能删除默认角色".to_string());
        }
        
        roles.remove(index);
        self.save_roles_to_file()
    }
    
    /// 获取配置
    pub fn get_config(&self) -> Result<AIConfig, String> {
        let config = self.config.lock()
            .map_err(|e| format!("获取配置数据失败: {}", e))?;
            
        Ok(config.clone())
    }
    
    /// 更新配置
    pub fn update_config(&self, updated_config: AIConfig) -> Result<(), String> {
        let mut config = self.config.lock()
            .map_err(|e| format!("获取配置数据失败: {}", e))?;
            
        *config = updated_config;
        self.save_config_to_file()
    }
}

/// AI提供商
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AIProvider {
    #[serde(rename = "openai")]
    OpenAI,
    #[serde(rename = "azure")]
    Azure,
    #[serde(rename = "anthropic")]
    Anthropic,
    #[serde(rename = "custom")]
    Custom,
}

/// AI角色
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub is_default: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

/// AI聊天消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

/// 聊天角色
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ChatRole {
    #[serde(rename = "system")]
    System,
    #[serde(rename = "user")]
    User,
    #[serde(rename = "assistant")]
    Assistant,
}

/// AI服务
pub struct AIService {
    config: Mutex<AIConfig>,
    roles: Mutex<Vec<Role>>,
}

impl AIService {
    /// 创建新的AI服务实例
    pub fn new(config: AIConfig) -> Self {
        Self {
            config: Mutex::new(config),
            roles: Mutex::new(vec![create_default_role()]),
        }
    }
    
    /// 加载默认角色
    pub fn load_roles(&self) -> Vec<Role> {
        let roles = self.roles.lock().unwrap();
        roles.clone()
    }
    
    /// 获取AI配置
    pub fn get_config(&self) -> AIConfig {
        let config = self.config.lock().unwrap();
        config.clone()
    }
    
    /// 更新AI配置
    pub fn update_config(&self, config: AIConfig) {
        let mut current_config = self.config.lock().unwrap();
        *current_config = config;
    }
    
    /// 添加新角色
    pub fn add_role(&self, role: Role) -> Result<(), String> {
        let mut roles = self.roles.lock().unwrap();
        
        // 检查ID是否已存在
        if roles.iter().any(|r| r.id == role.id) {
            return Err("角色ID已存在".to_string());
        }
        
        roles.push(role);
        Ok(())
    }
    
    /// 删除角色
    pub fn delete_role(&self, id: &str) -> Result<(), String> {
        let mut roles = self.roles.lock().unwrap();
        
        // 检查是否为默认角色
        if let Some(role) = roles.iter().find(|r| r.id == id) {
            if role.is_default {
                return Err("不能删除默认角色".to_string());
            }
        } else {
            return Err("角色不存在".to_string());
        }
        
        roles.retain(|r| r.id != id);
        Ok(())
    }
    
    /// 更新角色
    pub fn update_role(&self, role: Role) -> Result<(), String> {
        let mut roles = self.roles.lock().unwrap();
        
        let index = roles.iter().position(|r| r.id == role.id)
            .ok_or_else(|| "角色不存在".to_string())?;
        
        // 不能更改默认角色的默认状态
        if roles[index].is_default && !role.is_default {
            return Err("不能取消默认角色的默认状态".to_string());
        }
        
        // 更新角色
        roles[index] = role;
        Ok(())
    }
    
    /// 翻译文本
    pub async fn translate_text(&self, text: &str, target_language: &str) -> Result<String, String> {
        // 这里应该调用AI API进行翻译
        // 目前返回模拟结果
        Ok(format!("这是 {} 的{}翻译", text, target_language))
    }
    
    /// 总结文本
    pub async fn summarize_text(&self, text: &str) -> Result<String, String> {
        // 这里应该调用AI API进行总结
        // 目前返回模拟结果
        Ok(format!("这是 {} 的总结", text))
    }
}

/// 创建默认角色
fn create_default_role() -> Role {
    Role {
        id: "default".to_string(),
        name: "默认助手".to_string(),
        description: "一个通用的AI助手，可以帮助回答问题、翻译文本和总结内容。".to_string(),
        system_prompt: "你是一个运行在Copy2AI智能剪贴板的AI助手，擅长以风趣幽默、生动活泼的方式与用户交流，能够灵活运用各种emoji表情包增添趣味性。你可以帮助用户针对剪贴板中的内容进行精准回答、高效翻译和简洁总结，同时还能提供实用的建议和有趣的见解，让用户在使用过程中感受到便捷与快乐。".to_string(),
        is_default: true,
        created_at: chrono::Utc::now().timestamp_millis() as u64,
        updated_at: chrono::Utc::now().timestamp_millis() as u64,
    }
}

// 新增AI提供商设置相关结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIProviderSetting {
    pub custom_api_base_url: Option<String>,
    pub selected_model: String,
    pub api_key: Option<String>,
    pub models_list_url: Option<String>,
    pub temperature: f32,
    pub max_tokens: u32,
    pub use_stream: bool,
    pub dynamic_models: Option<Vec<String>>,
    pub last_test_time: Option<u64>,
    pub test_success: Option<bool>,
}

// 新增AI设置结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISettings {
    pub selected_provider_id: String,
    pub providers: std::collections::HashMap<String, AIProviderSetting>,
}

// 模型信息结构体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub max_tokens: Option<u32>,
}

// API测试结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct APITestResult {
    pub success: bool,
    pub message: String,
    pub response_time: Option<u64>,
}

// AI设置管理器
pub struct AISettingsManager {
    settings: Mutex<AISettings>,
    settings_file: PathBuf,
}

impl AISettingsManager {
    /// 创建新的AI设置管理器
    pub fn new(data_dir: PathBuf) -> Self {
        let settings_file = data_dir.join("ai_settings.json");
        
        // 尝试加载设置
        let settings = Self::load_settings_from_file(&settings_file).unwrap_or_else(|_| {
            // 默认使用Copy2AI
            let mut providers = std::collections::HashMap::new();
            
            // 添加Copy2AI提供商设置，含硬编码API密钥
            providers.insert("Copy2AI".to_string(), AIProviderSetting {
                custom_api_base_url: None,
                selected_model: "GLM-4-Flash-250414".to_string(),
                api_key: Some("d9885ff5e6b14c21a34065588fb0face.aOMiNs6uIDMo5yOX".to_string()),
                models_list_url: None,
                temperature: 0.7,
                max_tokens: 2048,
                use_stream: true,
                dynamic_models: None,
                last_test_time: None,
                test_success: None,
            });
            
            // 添加kimi提供商设置作为备选
            providers.insert("kimi".to_string(), AIProviderSetting {
                custom_api_base_url: None,
                selected_model: "moonshot-v1-8k".to_string(),
                api_key: None,
                models_list_url: None,
                temperature: 0.7,
                max_tokens: 2048,
                use_stream: true,
                dynamic_models: None,
                last_test_time: None,
                test_success: None,
            });
            
            AISettings {
                selected_provider_id: "Copy2AI".to_string(),
                providers,
            }
        });
        
        Self {
            settings: Mutex::new(settings),
            settings_file,
        }
    }
    
    /// 从文件加载设置
    fn load_settings_from_file(file_path: &PathBuf) -> Result<AISettings, String> {
        if !file_path.exists() {
            return Err("设置文件不存在".to_string());
        }
        
        let content = fs::read_to_string(file_path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
            
        serde_json::from_str(&content)
            .map_err(|e| format!("解析设置JSON失败: {}", e))
    }
    
    /// 保存设置到文件
    fn save_settings_to_file(&self) -> Result<(), String> {
        let settings = self.settings.lock()
            .map_err(|e| format!("获取设置数据失败: {}", e))?;
            
        let content = serde_json::to_string_pretty(&*settings)
            .map_err(|e| format!("序列化设置数据失败: {}", e))?;
            
        fs::write(&self.settings_file, content)
            .map_err(|e| format!("写入设置文件失败: {}", e))
    }
    
    /// 获取设置
    pub fn get_settings(&self) -> Result<AISettings, String> {
        let settings = self.settings.lock()
            .map_err(|e| format!("获取设置数据失败: {}", e))?;
            
        Ok(settings.clone())
    }
    
    /// 更新设置
    pub fn update_settings(&self, new_settings: AISettings) -> Result<(), String> {
        let mut settings = self.settings.lock()
            .map_err(|e| format!("获取设置数据失败: {}", e))?;
            
        *settings = new_settings;
        self.save_settings_to_file()
    }
    
    /// 获取提供商设置
    pub fn get_provider_setting(&self, provider_id: &str) -> Result<AIProviderSetting, String> {
        let settings = self.settings.lock()
            .map_err(|e| format!("获取设置数据失败: {}", e))?;
            
        settings.providers.get(provider_id)
            .cloned()
            .ok_or_else(|| format!("未找到提供商ID '{}'的设置", provider_id))
    }
    
    /// 更新提供商设置
    pub fn update_provider_setting(&self, provider_id: &str, setting: AIProviderSetting) -> Result<(), String> {
        let mut settings = self.settings.lock()
            .map_err(|e| format!("获取设置数据失败: {}", e))?;
            
        settings.providers.insert(provider_id.to_string(), setting);
        self.save_settings_to_file()
    }
}

#[tauri::command]
// Modify the function signature to accept the test URL (passed as api_base_url from frontend)
async fn test_api_connection(api_base_url: String, api_key: Option<String>, _model: String) -> Result<APITestResult, String> {
    let url_to_test = api_base_url;
    
    // Add the missing reqwest client initialization
    let client = reqwest::Client::new(); 

    let is_local_service = url_to_test.contains("localhost") || url_to_test.contains("127.0.0.1");
    let is_ollama_or_compatible = url_to_test.contains("open.bigmodel.cn/api/paas/v4") || 
                                url_to_test.ends_with("/v1") || 
                                url_to_test.ends_with("/v1/") ||
                                url_to_test.contains("localhost:11434"); // Common Ollama port
    
    let start_time = std::time::Instant::now();
    
    // Determine the correct endpoint to ping based on the service type
    let test_endpoint = if is_ollama_or_compatible {
        // Standard OpenAI compatible or Ollama endpoint for listing models or simple check
        // Prefer /models, but fallback might be needed for some servers
        if url_to_test.ends_with("/") {
            format!("{}models", url_to_test)
        } else {
            format!("{}/models", url_to_test)
        }
        // Alternatively, ping root or /health if /models isn't standard
        // format!("{}", url_to_test) 
    } else {
        // Fallback for non-standard APIs, maybe just ping the base URL?
        // Or assume it needs /models if not explicitly Ollama-like
         if url_to_test.ends_with("/") {
            format!("{}models", url_to_test)
        } else {
            format!("{}/models", url_to_test)
        }
    };
    
    println!("实际测试端点: {}", test_endpoint);
    
    // 发送请求到计算出的 test_endpoint
    let mut request = client.get(&test_endpoint); 
    
    // 只有非本地服务才强制验证API密钥
    // ... existing code ...

    let end_time = std::time::Instant::now();
    let response_time = end_time.duration_since(start_time).as_millis();
    
    Ok(APITestResult {
        success: true,
        message: "API连接测试成功".to_string(),
        response_time: Some(response_time as u64), 
    })
} 

// 聊天相关的结构定义
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatCompletionMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatCompletionMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<i32>,
    pub stream: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionChoice {
    pub index: usize,
    pub delta: ChatCompletionDelta,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionDelta {
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: u64,
    pub model: String,
    pub choices: Vec<ChatCompletionChoice>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorDetail {
    pub message: String,
    pub code: Option<String>,
}

// HTTP客户端辅助函数，用于发起请求
async fn make_http_request(
    url: &str,
    api_key: &str,
    request_body: &[u8],
    _stream: bool, // 添加下划线前缀表示有意不使用
) -> Result<Box<dyn AsyncRead + Unpin + Send>, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .body(request_body.to_vec())
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;
    
    if !response.status().is_success() {
        // 先保存状态码再调用text()
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        return Err(format!("API请求失败 ({}): {}", status, error_text));
    }
    
    // 转换为可读流，使用StreamReader来包装字节流
    let stream = response.bytes_stream()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, format!("{}", e)));
    
    let reader = StreamReader::new(stream);
    Ok(Box::new(reader))
}

// 基于Tauri事件的流式响应发送函数
async fn stream_chat_response<R: AsyncRead + Unpin + Send>(
    window: Window,
    event_name: &str,
    reader: &mut R,
) -> Result<(), String> {
    let mut buffer = Vec::new();
    // 不需要decoder，直接使用UTF-8解码
    
    loop {
        let mut chunk = vec![0; 1024];
        let n = reader.read(&mut chunk).await.map_err(|e| format!("读取响应失败: {}", e))?;
        
        if n == 0 {
            break;
        }
        
        chunk.truncate(n);
        buffer.extend_from_slice(&chunk);
        
        // 处理buffer中的每一行
        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line = buffer.drain(..=pos).collect::<Vec<_>>();
            
            // 直接使用UTF-8解码
            let line_str = String::from_utf8_lossy(&line);
            
            // 解析SSE数据行
            if let Some(data) = line_str.strip_prefix("data: ") {
                if data.trim() == "[DONE]" {
                    // 流结束
                    window.emit(event_name, "[DONE]")
                        .map_err(|e| format!("发送事件失败: {}", e))?;
                    return Ok(());
                }
                
                // 尝试解析JSON
                match serde_json::from_str::<ChatCompletionResponse>(data) {
                    Ok(response) => {
                        // 发送事件到前端
                        window.emit(event_name, &response)
                            .map_err(|e| format!("发送事件失败: {}", e))?;
                    },
                    Err(e) => {
                        eprintln!("解析JSON失败: {} (数据: {})", e, data);
                    }
                }
            }
        }
    }
    
    Ok(())
}

// 聊天完成函数，发起请求并返回结果
#[tauri::command]
pub async fn chat_completion(
    window: Window,
    provider_id: String, 
    messages: Vec<ChatCompletionMessage>,
    model: String,
    temperature: Option<f32>,
    max_tokens: Option<i32>,
    stream: bool,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // 解决MutexGuard不能Send的问题：在同步部分获取所有需要的值，然后释放锁
    let api_key;
    let api_base_url;
    
    {
        // 使用块作用域来确保MutexGuard尽早释放
        let ai_settings_manager = state.ai_settings_manager.lock().map_err(|_| "无法访问AI设置")?;
        let provider_setting = ai_settings_manager.get_provider_setting(&provider_id)?;
        
        // 复制这些值而不是保持MutexGuard
        api_key = provider_setting.api_key.clone().unwrap_or_default();
        api_base_url = provider_setting.custom_api_base_url.clone().unwrap_or_default();
    }
    
    // 构建请求体
    let request = ChatCompletionRequest {
        model: model.clone(),
        messages,
        temperature,
        max_tokens,
        stream: Some(stream),
    };
    
    let request_body = serde_json::to_vec(&request)
        .map_err(|e| format!("序列化请求失败: {}", e))?;
    
    // 构建API URL
    let url = format!("{}/chat/completions", api_base_url);
    
    // 使用唯一ID作为事件名
    let event_id = uuid::Uuid::new_v4().to_string();
    let event_name = format!("chat_response_{}", event_id);
    
    // 如果是流式响应
    if stream {
        // 创建一个新的任务来处理流式响应
        let window_clone = window.clone();
        let event_name_clone = event_name.clone(); // 克隆事件名
        
        tauri::async_runtime::spawn(async move {
            match make_http_request(&url, &api_key, &request_body, true).await {
                Ok(mut reader) => {
                    // 再次克隆window，避免移动
                    let window_for_stream = window_clone.clone();
                    
                    if let Err(e) = stream_chat_response(window_for_stream, &event_name_clone, &mut reader).await {
                        eprintln!("流式响应处理错误: {}", e);
                        // 发送错误事件
                        let _ = window_clone.emit(&event_name_clone, format!("ERROR: {}", e));
                    }
                    // 发送结束事件
                    let _ = window_clone.emit(&event_name_clone, "[DONE]");
                },
                Err(e) => {
                    eprintln!("创建请求失败: {}", e);
                    // 发送错误事件
                    let _ = window_clone.emit(&event_name_clone, format!("ERROR: {}", e));
                }
            }
        });
        
        // 立即返回事件名，前端将使用此名称监听事件
        Ok(event_name)
    } else {
        // 非流式响应
        let client = reqwest::Client::new();
        
        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", api_key))
            .body(request_body)
            .send()
            .await
            .map_err(|e| format!("网络请求失败: {}", e))?;
        
        if !response.status().is_success() {
            // 先保存状态码再调用text()
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
            return Err(format!("API请求失败 ({}): {}", status, error_text));
        }
        
        // 获取完整响应并返回
        let response_text = response.text().await
            .map_err(|e| format!("读取响应失败: {}", e))?;
        
        Ok(response_text)
    }
} 