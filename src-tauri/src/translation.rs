use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use md5;
use reqwest::Client;
use rand::Rng;
use tauri::AppHandle;
use std::time::Duration;

// 翻译设置结构体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranslationSettings {
    pub appid: String,
    pub key: String,
    pub translation_from: String,
    pub translation_to: String,
}

impl Default for TranslationSettings {
    fn default() -> Self {
        Self {
            appid: String::new(),
            key: String::new(),
            translation_from: "auto".to_string(),
            translation_to: "zh".to_string(),
        }
    }
}

// 翻译结果结构体
#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationResult {
    #[serde(default)]
    pub from: String,
    #[serde(default)]
    pub to: String,
    #[serde(default)]
    pub trans_result: Vec<TranslationItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_msg: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TranslationItem {
    pub src: String,
    pub dst: String,
}

// 翻译语言信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LanguageInfo {
    pub code: String, 
    pub name: String,
}

// 翻译管理器
#[derive(Clone)]
pub struct TranslationManager {
    settings: TranslationSettings,
    config_path: PathBuf,
    http_client: Client,
}

impl TranslationManager {
    // 创建一个新的翻译管理器实例
    pub fn new(config_dir: impl AsRef<Path>) -> Self {
        let config_path = config_dir.as_ref().join("translation_settings.json");
        let mut manager = Self {
            settings: TranslationSettings::default(),
            config_path,
            http_client: Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("Failed to create HTTP client"),
        };
        
        // 尝试加载配置，如果失败则使用默认值
        if let Err(e) = manager.load_settings() {
            eprintln!("Failed to load translation settings: {}", e);
        }
        
        manager
    }
    
    // 加载翻译设置
    fn load_settings(&mut self) -> Result<(), String> {
        if !self.config_path.exists() {
            return Ok(());
        }
        
        let mut file = File::open(&self.config_path).map_err(|e| e.to_string())?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
        
        if contents.trim().is_empty() {
            return Ok(());
        }
        
        self.settings = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    // 保存翻译设置
    fn save_settings(&self) -> Result<(), String> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        
        let json = serde_json::to_string_pretty(&self.settings).map_err(|e| e.to_string())?;
        
        let mut file = File::create(&self.config_path).map_err(|e| e.to_string())?;
        file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    // 获取当前翻译设置
    pub fn get_settings(&self) -> TranslationSettings {
        self.settings.clone()
    }
    
    // 更新翻译设置
    pub fn update_settings(&mut self, settings: TranslationSettings) -> Result<(), String> {
        self.settings = settings;
        self.save_settings()?;
        Ok(())
    }
    
    // 生成签名
    fn generate_sign(&self, text: &str, salt: &str) -> String {
        let sign_str = format!(
            "{}{}{}{}",
            self.settings.appid, text, salt, self.settings.key
        );
        
        // 使用md5库创建哈希
        let digest = md5::compute(sign_str);
        
        // 转换为32位小写的十六进制字符串
        format!("{:x}", digest)
    }
    
    // 执行翻译
    pub async fn translate(&self, text: &str) -> Result<TranslationResult, String> {
        if self.settings.appid.is_empty() || self.settings.key.is_empty() {
            return Err("翻译API凭证未设置".to_string());
        }
        
        // 添加字符限制检查
        const MAX_CHARS: usize = 2000;
        if text.chars().count() > MAX_CHARS {
            return Err(format!("翻译文本超出{}字符限制", MAX_CHARS));
        }
        
        // 生成随机数
        let salt = rand::thread_rng()
            .sample_iter(&rand::distributions::Alphanumeric)
            .take(8)
            .map(char::from)
            .collect::<String>();
        
        // 生成签名
        let sign = self.generate_sign(text, &salt);
        
        // 构建请求参数
        let mut params = HashMap::new();
        params.insert("q", text);
        params.insert("from", &self.settings.translation_from);
        params.insert("to", &self.settings.translation_to);
        params.insert("appid", &self.settings.appid);
        params.insert("salt", &salt);
        params.insert("sign", &sign);
        
        // 发送API请求
        let response = self.http_client
            .post("https://fanyi-api.baidu.com/api/trans/vip/translate")
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("请求翻译API失败: {}", e))?;
        
        // 检查HTTP状态码
        if !response.status().is_success() {
            let status = response.status();
            match response.text().await {
                Ok(error_text) => return Err(format!("API响应错误 ({}): {}", status, error_text)),
                Err(_) => return Err(format!("API响应错误: 状态码 {}", status)),
            }
        }
        
        // 获取响应文本进行日志记录和更好的错误处理
        let response_text = response.text().await
            .map_err(|e| format!("读取API响应失败: {}", e))?;
        
        // 尝试解析为TranslationResult结构
        match serde_json::from_str::<TranslationResult>(&response_text) {
            Ok(result) => {
                // 检查是否有错误码
                if let Some(error_code) = &result.error_code {
                    return Err(format!(
                        "翻译API返回错误: {}, {}",
                        error_code,
                        result.error_msg.as_deref().unwrap_or("未知错误")
                    ));
                }
                
                // 检查翻译结果是否为空
                if result.trans_result.is_empty() {
                    return Err(format!("翻译API未返回结果，响应内容: {}", response_text));
                }
                
                Ok(result)
            },
            Err(e) => {
                // 尝试先解析为Value以获取更多错误信息
                match serde_json::from_str::<serde_json::Value>(&response_text) {
                    Ok(json) => {
                        // 检查是否包含错误信息
                        if let Some(error_code) = json.get("error_code") {
                            let error_msg = json.get("error_msg")
                                .and_then(|m| m.as_str())
                                .unwrap_or("未知错误");
                            return Err(format!("翻译API返回错误: {}, {}", error_code, error_msg));
                        }
                        
                        // 尝试手动创建TranslationResult
                        if let Some(trans_array) = json.get("trans_result").and_then(|t| t.as_array()) {
                            let mut items = Vec::new();
                            
                            for item in trans_array {
                                if let (Some(src), Some(dst)) = (
                                    item.get("src").and_then(|s| s.as_str()),
                                    item.get("dst").and_then(|d| d.as_str())
                                ) {
                                    items.push(TranslationItem {
                                        src: src.to_string(),
                                        dst: dst.to_string(),
                                    });
                                }
                            }
                            
                            if !items.is_empty() {
                                let from = json.get("from").and_then(|f| f.as_str()).unwrap_or("auto").to_string();
                                let to = json.get("to").and_then(|t| t.as_str()).unwrap_or("").to_string();
                                
                                return Ok(TranslationResult {
                                    from,
                                    to,
                                    trans_result: items,
                                    error_code: None,
                                    error_msg: None,
                                });
                            }
                        }
                        
                        Err(format!("无法解析翻译结果: {}，响应内容: {}", e, response_text))
                    },
                    Err(_) => Err(format!("解析翻译结果失败: {}，响应内容: {}", e, response_text)),
                }
            }
        }
    }
    
    // 获取支持的语言列表
    pub fn get_supported_languages(&self) -> Vec<LanguageInfo> {
        vec![
            LanguageInfo { code: "auto".to_string(), name: "自动检测".to_string() },
            LanguageInfo { code: "zh".to_string(), name: "中文".to_string() },
            LanguageInfo { code: "en".to_string(), name: "英语".to_string() },
            LanguageInfo { code: "yue".to_string(), name: "粤语".to_string() },
            LanguageInfo { code: "wyw".to_string(), name: "文言文".to_string() },
            LanguageInfo { code: "jp".to_string(), name: "日语".to_string() },
            LanguageInfo { code: "kor".to_string(), name: "韩语".to_string() },
            LanguageInfo { code: "fra".to_string(), name: "法语".to_string() },
            LanguageInfo { code: "spa".to_string(), name: "西班牙语".to_string() },
            LanguageInfo { code: "th".to_string(), name: "泰语".to_string() },
            LanguageInfo { code: "ara".to_string(), name: "阿拉伯语".to_string() },
            LanguageInfo { code: "ru".to_string(), name: "俄语".to_string() },
            LanguageInfo { code: "pt".to_string(), name: "葡萄牙语".to_string() },
            LanguageInfo { code: "de".to_string(), name: "德语".to_string() },
            LanguageInfo { code: "it".to_string(), name: "意大利语".to_string() },
            LanguageInfo { code: "el".to_string(), name: "希腊语".to_string() },
            LanguageInfo { code: "nl".to_string(), name: "荷兰语".to_string() },
            LanguageInfo { code: "pl".to_string(), name: "波兰语".to_string() },
            LanguageInfo { code: "bul".to_string(), name: "保加利亚语".to_string() },
            LanguageInfo { code: "est".to_string(), name: "爱沙尼亚语".to_string() },
            LanguageInfo { code: "dan".to_string(), name: "丹麦语".to_string() },
            LanguageInfo { code: "fin".to_string(), name: "芬兰语".to_string() },
            LanguageInfo { code: "cs".to_string(), name: "捷克语".to_string() },
            LanguageInfo { code: "rom".to_string(), name: "罗马尼亚语".to_string() },
            LanguageInfo { code: "slo".to_string(), name: "斯洛文尼亚语".to_string() },
            LanguageInfo { code: "swe".to_string(), name: "瑞典语".to_string() },
            LanguageInfo { code: "hu".to_string(), name: "匈牙利语".to_string() },
            LanguageInfo { code: "cht".to_string(), name: "繁体中文".to_string() },
            LanguageInfo { code: "vie".to_string(), name: "越南语".to_string() },
        ]
    }
}

// 应用状态扩展
pub struct TranslationState {
    pub manager: Mutex<TranslationManager>,
}

// Tauri命令

// 获取翻译设置
#[tauri::command]
pub fn get_translation_settings(state: tauri::State<TranslationState>) -> Result<TranslationSettings, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_settings())
}

// 更新翻译设置
#[tauri::command]
pub fn update_translation_settings(
    state: tauri::State<TranslationState>,
    settings: TranslationSettings,
) -> Result<(), String> {
    let mut manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.update_settings(settings)
}

// 获取支持的语言列表
#[tauri::command]
pub fn get_supported_languages(
    state: tauri::State<TranslationState>,
) -> Result<Vec<LanguageInfo>, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_supported_languages())
}

// 执行翻译
#[tauri::command]
pub async fn translate_text(
    state: tauri::State<'_, TranslationState>,
    text: String,
) -> Result<TranslationResult, String> {
    // 先从锁中克隆我们需要的数据，然后释放锁
    let settings = {
        let manager = state.manager.lock().map_err(|e| e.to_string())?;
        manager.get_settings()
    };
    
    // 创建一个临时的翻译管理器用于此次请求
    let temp_manager = TranslationManager {
        settings,
        config_path: PathBuf::new(), // 不需要保存
        http_client: Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client"),
    };
    
    // 执行翻译
    temp_manager.translate(&text).await
}

// 测试API连接
#[tauri::command]
pub async fn test_translation_api(
    _state: tauri::State<'_, TranslationState>,
    settings: TranslationSettings,
) -> Result<bool, String> {
    // 创建临时翻译管理器
    let temp_manager = TranslationManager {
        settings,
        config_path: PathBuf::new(), // 不需要保存
        http_client: Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client"),
    };
    
    // 检查API凭证是否为空
    if temp_manager.settings.appid.is_empty() || temp_manager.settings.key.is_empty() {
        return Err("翻译API凭证未设置".to_string());
    }
    
    // 生成随机数
    let salt = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(8)
        .map(char::from)
        .collect::<String>();
    
    // 使用简单文本测试API
    let text = "hello";
    
    // 生成签名
    let sign = temp_manager.generate_sign(text, &salt);
    
    // 构建请求参数
    let mut params = HashMap::new();
    params.insert("q", text);
    params.insert("from", &temp_manager.settings.translation_from);
    params.insert("to", &temp_manager.settings.translation_to);
    params.insert("appid", &temp_manager.settings.appid);
    params.insert("salt", &salt);
    params.insert("sign", &sign);
    
    // 发送API请求
    let response = temp_manager.http_client
        .post("https://fanyi-api.baidu.com/api/trans/vip/translate")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("请求翻译API失败: {}", e))?;
    
    // 检查HTTP状态码
    if !response.status().is_success() {
        let status = response.status();
        match response.text().await {
            Ok(error_text) => return Err(format!("API响应错误 ({}): {}", status, error_text)),
            Err(_) => return Err(format!("API响应错误: 状态码 {}", status)),
        }
    }
    
    // 获取响应文本，以便更好地诊断问题
    let response_text = response.text().await
        .map_err(|e| format!("读取API响应失败: {}", e))?;
    
    // 尝试解析为JSON以检查基本格式
    match serde_json::from_str::<serde_json::Value>(&response_text) {
        Ok(json) => {
            // 检查是否包含错误代码
            if let Some(error_code) = json.get("error_code") {
                let error_msg = json.get("error_msg")
                    .and_then(|m| m.as_str())
                    .unwrap_or("未知错误");
                return Err(format!("翻译API返回错误: {}, {}", error_code, error_msg));
            }
            
            // 检查是否有翻译结果
            if json.get("trans_result").is_some() {
                return Ok(true);
            }
            
            // 其他情况，可能API格式变了或无法识别
            Err(format!("无法识别的API响应格式: {}", response_text))
        },
        Err(e) => Err(format!("无效的JSON响应: {}, 响应内容: {}", e, response_text)),
    }
} 