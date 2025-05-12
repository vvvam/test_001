// AI服务提供商数据模型
export interface AIProvider {
  id: string;            // 提供商唯一标识
  name: string;          // 提供商名称
  apiBaseUrl: string;    // API基础地址
  defaultModels: string[]; // 默认模型列表
  supportsModelsList: boolean; // 是否支持动态获取模型列表
  modelsListUrl?: string; // 模型列表API地址
  requiresApiKey: boolean; // 是否需要API Key
  description?: string;  // 服务描述
  website?: string;      // 官方网站
}

// 用户配置的AI服务提供商设置
export interface AIProviderSettings {
  custom_api_base_url?: string; // 自定义API地址
  selected_model: string;    // 选择的模型
  api_key?: string;          // API Key
  models_list_url?: string;   // 自定义模型列表API地址
  temperature: number;      // 生成内容的随机性 (0-1)
  max_tokens: number;        // 生成的最大token数
  use_stream: boolean;       // 是否使用流式输出
  dynamic_models?: string[]; // 动态加载的模型列表
  last_test_time?: number;    // 最后测试时间
  test_success?: boolean;    // 测试是否成功
}

// 全局AI设置
export interface AISettings {
  selected_provider_id: string; // 当前选择的提供商ID
  providers: Record<string, AIProviderSettings>; // 各提供商的具体设置
}

// API测试结果
export interface APITestResult {
  success: boolean;
  message: string;
  response_time?: number;
}

// 模型信息
export interface ModelInfo {
  id: string;
  name?: string;
  description?: string;
  max_tokens?: number;
  owned?: boolean;
} 