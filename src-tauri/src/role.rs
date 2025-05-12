use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// AI角色定义
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Role {
    pub id: String,
    pub name: String,
    pub description: String,
    pub system_prompt: String,
    pub icon: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    pub is_custom: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

/// 角色操作结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleOperationResult {
    pub success: bool,
    pub message: Option<String>,
    pub data: Option<serde_json::Value>,
}

impl Role {
    /// 创建一个新的角色
    pub fn new(name: String, description: String, system_prompt: String, icon: String) -> Self {
        let now = chrono::Utc::now().timestamp_millis() as u64;
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            system_prompt,
            icon,
            avatar: None,
            is_custom: true,
            created_at: now,
            updated_at: now,
        }
    }
    
    /// 创建预设角色
    pub fn new_preset(name: String, description: String, system_prompt: String, icon: String) -> Self {
        let now = chrono::Utc::now().timestamp_millis() as u64;
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            system_prompt,
            icon,
            avatar: None,
            is_custom: false,
            created_at: now,
            updated_at: now,
        }
    }
    
    /// 更新角色的最后修改时间
    pub fn update_timestamp(&mut self) {
        self.updated_at = chrono::Utc::now().timestamp_millis() as u64;
    }
} 