use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 剪贴板条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardItem {
    pub id: String,
    pub content: String,
    pub timestamp: u64,
    pub favorite: bool,
    pub pinned: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "aiAnalysisCount", alias = "aiAnalysisCount")]
    pub ai_analysis_count: Option<u32>,
}

/// 剪贴板操作结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardOperationResult {
    pub success: bool,
    pub message: Option<String>,
    pub data: Option<serde_json::Value>,
}

/// 剪贴板筛选选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardFilter {
    pub search_text: Option<String>,
    pub show_favorites_only: bool,
    pub show_pinned_only: bool,
    pub category: Option<String>,
}

impl ClipboardItem {
    /// 创建一个新的剪贴板条目
    pub fn new(content: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            content,
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
            favorite: false,
            pinned: false,
            category: None,
            translation: None,
            summary: None,
            ai_analysis_count: None,
        }
    }
    
    /// 检查条目是否匹配筛选条件
    pub fn matches_filter(&self, filter: &ClipboardFilter) -> bool {
        // 检查搜索文本
        if let Some(search_text) = &filter.search_text {
            if !search_text.is_empty() && !self.content.to_lowercase().contains(&search_text.to_lowercase()) {
                return false;
            }
        }
        
        // 检查收藏状态
        if filter.show_favorites_only && !self.favorite {
            return false;
        }
        
        // 检查固定状态
        if filter.show_pinned_only && !self.pinned {
            return false;
        }
        
        // 检查分类
        if let Some(category) = &filter.category {
            if self.category.as_ref() != Some(category) {
                return false;
            }
        }
        
        true
    }
} 