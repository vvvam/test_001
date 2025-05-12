/**
 * AI角色定义
 */
export interface Role {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  icon: string;
  avatar: string | null;
  is_custom: boolean;
  created_at: number;
  updated_at: number;
}

/**
 * 角色操作结果
 */
export interface RoleOperationResult {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * 创建新角色的参数
 */
export interface CreateRoleParams {
  name: string;
  description: string;
  system_prompt: string;
  icon: string;
}

/**
 * 预设角色图标集
 */
export const ROLE_ICONS = [
  '💻', '✍️', '📝', '🌐', '🤖', '🔍', '📊', '📚',
  '🎨', '🎭', '🎬', '🎵', '📱', '💼', '🏆', '🛒',
  '🌍', '🧠', '🧪', '📈', '📉', '⚙️', '💭', '💰',
]; 