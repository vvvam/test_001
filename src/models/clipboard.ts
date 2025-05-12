// 剪贴板条目类型定义
export interface ClipboardItem {
  id: string;
  content: string;
  timestamp: number;
  favorite: boolean;
  pinned: boolean;
  category?: string;
  translation?: string;
  summary?: string;
  index?: number; // 用于显示序号，在前端处理时添加
  aiAnalysisCount?: number; // 用于记录AI分析次数
}

// 剪贴板筛选选项
export interface ClipboardFilter {
  searchText: string;
  showFavoritesOnly: boolean;
  showPinnedOnly: boolean;
  category?: string;
}

// 剪贴板操作结果
export interface ClipboardOperationResult {
  success: boolean;
  message?: string;
  data?: any;
}

// AI角色类型定义
export interface AIRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  icon?: string;
}

// 清空选项
export enum ClearOption {
  ALL = 'all',           // 清空所有
  TODAY = 'today',       // 清空今天
  THIS_WEEK = 'thisWeek', // 清空本周
  PINNED = 'pinned',     // 清空固定项
  FAVORITES = 'favorites' // 清空收藏项
} 