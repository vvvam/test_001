import { create } from 'zustand';

// 分析数据的接口定义
export interface AnalysisDataItem {
  id: string;
  content: string;
  timestamp: number;
}

// 分析数据存储的状态接口
interface AnalysisDataState {
  clipboardId: string | null;
  content: string | null;
  isMultipleItems: boolean;
  rawItems: AnalysisDataItem[] | null;
  roleId: string | null;
  timestamp: number | null;
  
  // 设置分析数据
  setAnalysisData: (data: {
    clipboardId: string;
    content: string;
    isMultipleItems: boolean;
    rawItems: AnalysisDataItem[];
    roleId: string;
  }) => void;
  
  // 清除分析数据
  clearAnalysisData: () => void;
  
  // 检查是否有分析数据
  hasAnalysisData: () => boolean;
}

// 创建分析数据存储
export const useAnalysisDataStore = create<AnalysisDataState>((set, get) => ({
  clipboardId: null,
  content: null,
  isMultipleItems: false,
  rawItems: null,
  roleId: null,
  timestamp: null,
  
  // 设置分析数据
  setAnalysisData: (data) => {
    set({
      clipboardId: data.clipboardId,
      content: data.content,
      isMultipleItems: data.isMultipleItems,
      rawItems: data.rawItems,
      roleId: data.roleId,
      timestamp: Date.now()
    });
  },
  
  // 清除分析数据
  clearAnalysisData: () => {
    set({
      clipboardId: null,
      content: null,
      isMultipleItems: false,
      rawItems: null,
      roleId: null,
      timestamp: null
    });
  },
  
  // 检查是否有分析数据
  hasAnalysisData: () => {
    return get().clipboardId !== null && get().content !== null;
  }
})); 