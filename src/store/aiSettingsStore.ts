import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { AISettings, AIProviderSettings, APITestResult, ModelInfo } from '../models/ai';
import { DEFAULT_AI_PROVIDERS } from '../constants/aiProviders';

// 创建初始状态
const createInitialState = (): AISettings => {
  // 确保每个提供商都有必要的默认字段
  const providers = DEFAULT_AI_PROVIDERS.reduce((acc, provider) => {
    const defaultModel = provider.defaultModels && provider.defaultModels.length > 0 
      ? provider.defaultModels[0] 
      : 'default';  // 必须有一个默认值
    
    // 为Copy2AI设置硬编码的API密钥
    const apiKey = provider.id === 'Copy2AI' 
      ? 'd9885ff5e6b14c21a34065588fb0face.aOMiNs6uIDMo5yOX'
      : undefined;
      
    return {
      ...acc,
      [provider.id]: {
        selected_model: defaultModel,
        temperature: 0.7,
        max_tokens: 2048,
        use_stream: true,
        custom_api_base_url: undefined,  // 使用undefined而不是null
        api_key: apiKey,
        models_list_url: undefined,
        dynamic_models: [],
        last_test_time: undefined,
        test_success: undefined
      } as AIProviderSettings
    };
  }, {});

  return {
    selected_provider_id: 'Copy2AI', // 默认选择 Copy2AI
    providers
  };
};

// 验证AI设置函数，确保所有必须字段都存在
const validateSettings = (settings: AISettings): AISettings => {
  if (!settings) return createInitialState();
  
  // 确保有选中的提供商ID
  if (!settings.selected_provider_id) {
    settings.selected_provider_id = 'Copy2AI';
  }
  
  // 确保providers存在且为对象
  if (!settings.providers || typeof settings.providers !== 'object') {
    settings.providers = {} as Record<string, AIProviderSettings>;
  }
  
  // 确保Copy2AI提供商设置存在，并设置API密钥
  if (!settings.providers['Copy2AI']) {
    settings.providers['Copy2AI'] = {
      selected_model: 'GLM-4-Flash-250414',
      temperature: 0.7,
      max_tokens: 2048,
      use_stream: true,
      api_key: 'd9885ff5e6b14c21a34065588fb0face.aOMiNs6uIDMo5yOX'
    } as AIProviderSettings;
  } else if (!settings.providers['Copy2AI'].api_key) {
    // 确保Copy2AI始终有API密钥
    settings.providers['Copy2AI'].api_key = 'd9885ff5e6b14c21a34065588fb0face.aOMiNs6uIDMo5yOX';
  }
  
  // 确保每个提供商都有有效的设置
  const validatedProviders: Record<string, AIProviderSettings> = Object.entries(settings.providers).reduce((acc, [providerId, providerSetting]) => {
    // 如果provider设置为null或undefined，创建一个默认设置
    if (!providerSetting) {
      const provider = DEFAULT_AI_PROVIDERS.find(p => p.id === providerId);
      const defaultModel = provider?.defaultModels?.[0] || 'default';
      
      return {
        ...acc,
        [providerId]: {
          selected_model: defaultModel,
          temperature: 0.7,
          max_tokens: 2048,
          use_stream: true
        } as AIProviderSettings
      };
    }
    
    // 确保必要字段存在
    return {
      ...acc,
      [providerId]: {
        ...providerSetting,
        selected_model: providerSetting.selected_model || 'default',
        temperature: typeof providerSetting.temperature === 'number' ? providerSetting.temperature : 0.7,
        max_tokens: typeof providerSetting.max_tokens === 'number' ? providerSetting.max_tokens : 2048,
        use_stream: typeof providerSetting.use_stream === 'boolean' ? providerSetting.use_stream : true
      } as AIProviderSettings
    };
  }, {} as Record<string, AIProviderSettings>);
  
  // 确保DEFAULT_AI_PROVIDERS中的每个提供商都有设置
  DEFAULT_AI_PROVIDERS.forEach(provider => {
    if (!validatedProviders[provider.id]) {
      const defaultModel = provider.defaultModels?.[0] || 'default';
      validatedProviders[provider.id] = {
        selected_model: defaultModel,
        temperature: 0.7,
        max_tokens: 2048,
        use_stream: true
      } as AIProviderSettings;
    }
  });
  
  return {
    ...settings,
    providers: validatedProviders
  };
};

// AI设置状态管理
interface AISettingsStore {
  // 状态
  settings: AISettings;
  isLoading: boolean;
  
  // 操作
  updateSettings: (newSettings: Partial<AISettings>) => void;
  updateProviderSettings: (providerId: string, settings: Partial<AIProviderSettings>) => void;
  loadModels: (providerId: string) => Promise<ModelInfo[]>;
  testConnection: (providerId: string) => Promise<APITestResult>;
  saveSettings: () => Promise<void>;
}

// 创建全局状态
export const useAISettingsStore = create<AISettingsStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      settings: createInitialState(),
      isLoading: false,
      
      // 更新整体设置
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      
      // 更新提供商设置
      updateProviderSettings: (providerId, settings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            providers: {
              ...state.settings.providers,
              [providerId]: {
                ...state.settings.providers[providerId],
                ...settings
              }
            }
          }
        }));
      },
      
      // 加载动态模型列表
      loadModels: async (providerId) => {
        set({ isLoading: true });
        
        try {
          const state = get().settings;
          const provider = DEFAULT_AI_PROVIDERS.find(p => p.id === providerId);
          
          if (!provider || !provider.supportsModelsList) {
            set({ isLoading: false });
            return [];
          }
          
          const providerSettings = state.providers[providerId];
          
          // 获取参数
          const url = providerSettings.models_list_url || provider.modelsListUrl;
          const apiKey = providerSettings.api_key;
          const apiBaseUrl = providerSettings.custom_api_base_url || provider.apiBaseUrl;
          
          if (!url) {
            set({ isLoading: false });
            return [];
          }
          
          // 检查是否是本地服务
          const isLocalService = url.includes('localhost') || url.includes('127.0.0.1');
          const requiresApiKey = provider.requiresApiKey && !isLocalService;
          
          // 验证API密钥（仅当需要时）
          if (requiresApiKey && (!apiKey || apiKey.trim() === '')) {
            console.error(`提供商 ${providerId} 需要API密钥`);
            throw new Error(`${provider.name} 需要API密钥才能获取模型列表`);
          }
          
          console.log(`正在加载模型列表，提供商: ${providerId}, URL: ${url}, 需要API密钥: ${requiresApiKey}`);
          
          try {
            // 调用Tauri后端获取模型列表
            const models = await invoke<ModelInfo[]>('fetch_models', { 
              url,
              apiKey,
              apiBaseUrl
            });
            
            console.log(`成功加载 ${models.length} 个模型`);
            
            // 更新状态
            set((state) => {
              // 获取当前选择的模型，如果不在新的模型列表中，则选择第一个模型
              const currentModel = state.settings.providers[providerId]?.selected_model;
              const modelIds = models.map(m => m.id);
              
              // 确保有一个有效的模型被选中
              let newSelectedModel = currentModel;
              
              // 如果当前模型不在新的模型列表中，或者没有当前模型
              if (!currentModel || !modelIds.includes(currentModel)) {
                // 如果有新模型，则选择第一个，否则保留当前模型（可能无效，但总比没有好）
                newSelectedModel = modelIds.length > 0 ? modelIds[0] : (currentModel || 'default');
                console.log(`为提供商 ${providerId} 设置新模型: ${newSelectedModel}`);
              }
              
              return {
                settings: {
                  ...state.settings,
                  providers: {
                    ...state.settings.providers,
                    [providerId]: {
                      ...state.settings.providers[providerId],
                      dynamic_models: modelIds,
                      selected_model: newSelectedModel // 始终设置一个模型，确保永远有值
                    }
                  }
                },
                isLoading: false
              };
            });
            
            return models;
          } catch (error) {
            console.error('获取模型列表失败', error);
            throw new Error(`获取模型列表失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        } catch (error) {
          console.error('模型加载过程中出错', error);
          set({ isLoading: false });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      
      // 测试API连接
      testConnection: async (providerId) => {
        set({ isLoading: true });
        
        try {
          const state = get().settings;
          const provider = DEFAULT_AI_PROVIDERS.find(p => p.id === providerId);
          
          if (!provider) {
            return { success: false, message: '未找到提供商信息' };
          }
          
          const providerSettings = state.providers[providerId];
          
          const apiBaseUrl = providerSettings.custom_api_base_url || provider.apiBaseUrl;
          const apiKey = providerSettings.api_key;
          const model = providerSettings.selected_model;
          
          // 检查是否是本地服务
          const isLocalService = apiBaseUrl.includes('localhost') || apiBaseUrl.includes('127.0.0.1');
          const requiresApiKey = provider.requiresApiKey && !isLocalService;
          
          // 验证API密钥（仅当需要时）
          if (requiresApiKey && (!apiKey || apiKey.trim() === '')) {
            console.error(`提供商 ${providerId} 需要API密钥`);
            throw new Error(`${provider.name} 需要API密钥才能连接`);
          }
          
          console.log(`测试API连接，提供商: ${providerId}, URL: ${apiBaseUrl}, 需要API密钥: ${requiresApiKey}`);
          
          // 调用Tauri后端测试API连接
          const result = await invoke<APITestResult>('test_api_connection', {
            apiBaseUrl,
            apiKey,
            model
          });
          
          // 更新测试结果状态
          set((state) => {
            const currentSettings = state.settings.providers[providerId];
            return {
              settings: {
                ...state.settings,
                providers: {
                  ...state.settings.providers,
                  [providerId]: {
                    ...currentSettings,
                    last_test_time: Date.now(),
                    test_success: result.success,
                    // 确保 selected_model 始终存在
                    selected_model: currentSettings.selected_model || 
                      (provider?.defaultModels && provider.defaultModels.length > 0 
                        ? provider.defaultModels[0] 
                        : 'default')
                  }
                }
              }
            };
          });
          
          return result;
        } catch (error) {
          console.error('API连接测试失败', error);
          set({ isLoading: false });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      
      // 替换原来的saveSettings方法，使用更简单的方法
      saveSettings: async () => {
        try {
          set({ isLoading: true });
          console.log('开始保存AI设置...');
          
          // 获取当前设置
          const currentSettings = get().settings;
          const providerId = currentSettings.selected_provider_id;
          
          // 获取当前提供商设置
          const provider = currentSettings.providers[providerId];
          
          if (!provider) {
            throw new Error(`找不到提供商设置: ${providerId}`);
          }
          
          console.log(`保存设置，提供商: ${providerId}`);
          
          // 调用后端保存设置
          await invoke('update_provider_setting', { 
            provider_id: providerId, 
            settings: provider 
          });
          
          console.log('设置保存完成');
          return;
        } catch (error) {
          console.error('设置保存过程出错:', error);
          throw error;
        } finally {
          console.log('保存过程完成');
          set({ isLoading: false });
        }
      }
    }),
    {
      name: 'ai-settings-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      // 添加onRehydrateStorage钩子，在数据恢复后进行验证
      onRehydrateStorage: () => (state) => {
        if (state && state.settings) {
          console.log('从存储恢复AI设置，进行验证');
          state.settings = validateSettings(state.settings);
        }
      }
    }
  )
); 