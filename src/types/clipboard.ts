export interface ClipboardItem {
  id: string;
  content: string;
  timestamp: number;
  favorite: boolean;
  pinned: boolean;
  category?: string;
  translation?: string;
  summary?: string;
  aiAnalysisCount?: number;
  
  // 前端特有属性（用于兼容组件内使用）
  isPinned?: boolean;
  isFavorite?: boolean;
  contentType?: string;
  metadata?: {
    [key: string]: any;
  };
} 