import { create } from 'zustand';

// 定义分析数据接口
export interface AnalysisItem {
  id?: string;
  content: string;
  timestamp: number;
}

// 定义分析状态接口
export interface AnalysisData {
  clipboardId: string;
  content: string;
  isMultipleItems: boolean;
  itemsCount?: number;
  rawItems?: Array<AnalysisItem>;
  roleId: string;
  timestamp: number;
}

// 定义分析存储接口
interface AnalysisStore {
  analysisData: AnalysisData | null;
  setAnalysisData: (data: AnalysisData) => void;
  clearAnalysisData: () => void;
}

// 创建分析存储
const useAnalysisStore = create<AnalysisStore>((set) => ({
  analysisData: null,
  setAnalysisData: (data) => set({ analysisData: data }),
  clearAnalysisData: () => set({ analysisData: null }),
}));

export default useAnalysisStore; 