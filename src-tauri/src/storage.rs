use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use crate::clipboard::{ClipboardItem, ClipboardFilter};
use serde::{Serialize, Deserialize};

/// 存储配置
#[derive(Serialize, Deserialize, Clone, Debug)]
struct StorageConfig {
    max_items: usize,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            max_items: 404, // 默认最大保存404条记录
        }
    }
}

/// 存储管理器
pub struct Storage {
    file_path: PathBuf,
    config_path: PathBuf,
    items: HashMap<String, ClipboardItem>,
    config: StorageConfig,
}

impl Storage {
    /// 创建一个新的存储管理器
    pub fn new(file_path: PathBuf) -> Self {
        let config_path = file_path.with_file_name("clipboard_config.json");
        
        let mut storage = Self {
            file_path,
            config_path,
            items: HashMap::new(),
            config: StorageConfig::default(),
        };
        
        // 加载配置
        storage.load_config().unwrap_or_else(|_e| {
            // eprintln!("加载存储配置失败: {}", e);
        });
        
        // 加载现有数据
        storage.load().unwrap_or_else(|_e| {
            // eprintln!("加载剪贴板历史失败: {}", e);
        });
        
        storage
    }
    
    /// 从文件加载配置
    fn load_config(&mut self) -> Result<(), String> {
        // 如果文件不存在，使用默认配置
        if !self.config_path.exists() {
            return Ok(());
        }
        
        // 读取文件内容
        let mut file = File::open(&self.config_path).map_err(|e| e.to_string())?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
        
        // 如果文件为空，使用默认配置
        if contents.trim().is_empty() {
            return Ok(());
        }
        
        // 解析JSON数据
        self.config = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        
        Ok(())
    }
    
    /// 保存配置到文件
    fn save_config(&self) -> Result<(), String> {
        // 确保目录存在
        if let Some(parent) = self.config_path.parent() {
            match fs::create_dir_all(parent) {
                Ok(_) => {},
                Err(e) => {
                    let error_msg = format!("创建配置目录失败: {:?} - {}", parent, e);
                    return Err(error_msg);
                }
            }
        }
        
        // 序列化为JSON
        let json = match serde_json::to_string_pretty(&self.config) {
            Ok(json) => json,
            Err(e) => {
                let error_msg = format!("序列化配置数据失败: {}", e);
                return Err(error_msg);
            }
        };
        
        // 写入文件
        match File::create(&self.config_path) {
            Ok(mut file) => {
                match file.write_all(json.as_bytes()) {
                    Ok(_) => Ok(()),
                    Err(e) => {
                        let error_msg = format!("写入配置文件失败: {}", e);
                        Err(error_msg)
                    }
                }
            },
            Err(e) => {
                let error_msg = format!("创建配置文件失败: {:?} - {}", self.config_path, e);
                Err(error_msg)
            }
        }
    }
    
    /// 从文件加载数据
    fn load(&mut self) -> Result<(), String> {
        // 如果文件不存在，返回空数据
        if !self.file_path.exists() {
            return Ok(());
        }
        
        // 读取文件内容
        let mut file = File::open(&self.file_path).map_err(|e| e.to_string())?;
        let mut contents = String::new();
        file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
        
        // 如果文件为空，返回空数据
        if contents.trim().is_empty() {
            return Ok(());
        }
        
        // 解析JSON数据
        let items: Vec<ClipboardItem> = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        
        // 转换为HashMap
        for item in items {
            self.items.insert(item.id.clone(), item);
        }
        
        Ok(())
    }
    
    /// 保存数据到文件
    fn save(&self) -> Result<(), String> {
        // 确保目录存在
        if let Some(parent) = self.file_path.parent() {
            match fs::create_dir_all(parent) {
                Ok(_) => {},
                Err(e) => {
                    let error_msg = format!("创建历史记录目录失败: {:?} - {}", parent, e);
                    return Err(error_msg);
                }
            }
        }
        
        // 将HashMap转换为Vec
        let items: Vec<ClipboardItem> = self.items.values().cloned().collect();
        
        // 序列化为JSON
        let json = match serde_json::to_string_pretty(&items) {
            Ok(json) => json,
            Err(e) => {
                let error_msg = format!("序列化历史记录数据失败: {}", e);
                return Err(error_msg);
            }
        };
        
        // 写入文件
        match File::create(&self.file_path) {
            Ok(mut file) => {
                match file.write_all(json.as_bytes()) {
                    Ok(_) => Ok(()),
                    Err(e) => {
                        let error_msg = format!("写入历史记录文件失败: {}", e);
                        Err(error_msg)
                    }
                }
            },
            Err(e) => {
                let error_msg = format!("创建历史记录文件失败: {:?} - {}", self.file_path, e);
                Err(error_msg)
            }
        }
    }
    
    /// 获取所有剪贴板条目
    pub fn get_all_items(&self) -> Vec<ClipboardItem> {
        let mut items: Vec<ClipboardItem> = self.items.values().cloned().collect();
        
        // 按照固定 > 收藏 > 时间戳排序
        items.sort_by(|a, b| {
            if a.pinned && !b.pinned {
                std::cmp::Ordering::Less
            } else if !a.pinned && b.pinned {
                std::cmp::Ordering::Greater
            } else if a.favorite && !b.favorite {
                std::cmp::Ordering::Less
            } else if !a.favorite && b.favorite {
                std::cmp::Ordering::Greater
            } else {
                b.timestamp.cmp(&a.timestamp)
            }
        });
        
        items
    }
    
    /// 获取单个剪贴板条目
    pub fn get_item(&self, id: &str) -> Option<&ClipboardItem> {
        self.items.get(id)
    }
    
    /// 获取符合筛选条件的剪贴板条目
    pub fn get_filtered_items(&self, filter: &ClipboardFilter) -> Vec<ClipboardItem> {
        let mut items: Vec<ClipboardItem> = self.items
            .values()
            .filter(|item| item.matches_filter(filter))
            .cloned()
            .collect();
        
        // 按照固定 > 收藏 > 时间戳排序
        items.sort_by(|a, b| {
            if a.pinned && !b.pinned {
                std::cmp::Ordering::Less
            } else if !a.pinned && b.pinned {
                std::cmp::Ordering::Greater
            } else if a.favorite && !b.favorite {
                std::cmp::Ordering::Less
            } else if !a.favorite && b.favorite {
                std::cmp::Ordering::Greater
            } else {
                b.timestamp.cmp(&a.timestamp)
            }
        });
        
        items
    }
    
    /// 获取带分页和过滤条件的剪贴板条目
    pub fn get_filtered_paged_items(&self, filter: Option<&ClipboardFilter>, offset: usize, limit: usize) -> Vec<ClipboardItem> {
        // 首先应用过滤条件
        let mut items: Vec<ClipboardItem> = if let Some(filter) = filter {
            self.items
                .values()
                .filter(|item| item.matches_filter(filter))
                .cloned()
                .collect()
        } else {
            self.items.values().cloned().collect()
        };
        
        // 按照固定 > 收藏 > 时间戳排序
        items.sort_by(|a, b| {
            if a.pinned && !b.pinned {
                std::cmp::Ordering::Less
            } else if !a.pinned && b.pinned {
                std::cmp::Ordering::Greater
            } else if a.favorite && !b.favorite {
                std::cmp::Ordering::Less
            } else if !a.favorite && b.favorite {
                std::cmp::Ordering::Greater
            } else {
                b.timestamp.cmp(&a.timestamp)
            }
        });
        
        // 应用分页
        let start = std::cmp::min(offset, items.len());
        let end = std::cmp::min(start + limit, items.len());
        
        items[start..end].to_vec()
    }
    
    /// 获取符合条件的记录总数
    pub fn get_filtered_count(&self, filter: Option<&ClipboardFilter>) -> usize {
        if let Some(filter) = filter {
            self.items
                .values()
                .filter(|item| item.matches_filter(filter))
                .count()
        } else {
            self.items.len()
        }
    }
    
    /// 添加剪贴板条目
    pub fn add_item(&mut self, item: ClipboardItem) -> Result<(), String> {
        // 添加条目
        self.items.insert(item.id.clone(), item);
        
        // 如果超过最大条目数，删除最旧的非固定、非收藏条目
        if self.items.len() > self.config.max_items {
            let mut items: Vec<ClipboardItem> = self.items.values().cloned().collect();
            
            // 按时间戳排序（从旧到新）
            items.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
            
            // 找到最旧的非固定、非收藏条目
            if let Some(oldest) = items.iter().find(|item| !item.pinned && !item.favorite) {
                self.items.remove(&oldest.id);
            }
        }
        
        // 保存到文件
        self.save()
    }
    
    /// 更新剪贴板条目
    pub fn update_item(&mut self, item: ClipboardItem) -> Result<(), String> {
        // 检查条目是否存在
        if !self.items.contains_key(&item.id) {
            return Err(format!("条目不存在: {}", item.id));
        }
        
        // 更新条目
        self.items.insert(item.id.clone(), item);
        
        // 保存到文件
        self.save()
    }
    
    /// 删除剪贴板条目
    pub fn remove_item(&mut self, id: &str) -> Result<(), String> {
        // 检查条目是否存在
        if !self.items.contains_key(id) {
            return Err(format!("条目不存在: {}", id));
        }
        
        // 删除条目
        self.items.remove(id);
        
        // 保存到文件
        self.save()
    }
    
    /// 清空所有剪贴板条目
    pub fn clear_all(&mut self) -> Result<(), String> {
        // 清空集合
        self.items.clear();
        
        // 保存到文件
        self.save()
    }
    
    /// 设置最大保存条目数
    pub fn set_max_items(&mut self, max_items: usize) -> Result<(), String> {
        // 增加限制，确保设置的值不超过 4000
        self.config.max_items = std::cmp::min(max_items, 4000);
        // 保存配置到文件
        self.save_config()
    }
    
    /// 获取最大保存条目数
    pub fn get_max_items(&self) -> usize {
        self.config.max_items
    }
} 