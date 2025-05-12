import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  Select, 
  Input, 
  Switch, 
  Button, 
  Form, 
  Tabs, 
  message, 
  Space, 
  Divider, 
  Tooltip, 
  InputNumber,
  Row,
  Col,
  Tag,
  Typography,
  Spin,
  Alert,
  List,
  Badge,
  Modal,
  Drawer,
  Popover,
  Steps,
  DrawerProps
} from 'antd';
import { 
  RobotOutlined, 
  ApiOutlined, 
  KeyOutlined, 
  SettingOutlined, 
  SaveOutlined, 
  QuestionCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  SyncOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  EditOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  CaretRightOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAISettingsStore } from '../store/aiSettingsStore';
import { DEFAULT_AI_PROVIDERS } from '../constants/aiProviders';
import { useTheme } from '../context/ThemeContext';
import { invoke } from '@tauri-apps/api/core';
import { AIProviderSettings } from '../models/ai';

const { Option } = Select;
const { TabPane } = Tabs;
const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

// 添加设置流程组件
const AISetupFlow: React.FC<{
  selectedProviderId: string;
  providerSettings: AIProviderSettings;
  handleProviderChange: (value: string) => void;
  handleApiKeyChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTestConnection: () => Promise<void>;
  testResult: {
    success?: boolean;
    message?: string;
    loading: boolean;
  }
  loadModels: () => Promise<void>;
  loadingModels: boolean;
  isDarkMode: boolean;
  getSelectedModelValue: () => string[];
  handleModelChange: (value: string | string[]) => void;
  getModelOptions: () => React.ReactNode[];
  handleApiUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({
  selectedProviderId,
  providerSettings,
  handleProviderChange,
  handleApiKeyChange,
  handleTestConnection,
  testResult,
  loadModels,
  loadingModels,
  isDarkMode,
  getSelectedModelValue,
  handleModelChange,
  getModelOptions,
  handleApiUrlChange
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const selectedProvider = DEFAULT_AI_PROVIDERS.find(p => p.id === selectedProviderId);

  // 进入下一步
  const nextStep = () => {
    setCurrentStep(currentStep + 1);
  };

  // 返回上一步
  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  return (
    <div style={{ marginBottom: 24 }}>
 
      
      <Steps
        current={currentStep}
        items={[
          {
            title: '选择AI服务提供商',
            description: '',
            status: currentStep === 0 ? 'process' : currentStep > 0 ? 'finish' : 'wait',
          },
          {
            title: '配置API密钥',
            description: '',
            status: currentStep === 1 ? 'process' : currentStep > 1 ? 'finish' : 'wait',
          },
          {
            title: '测试连接',
            description: '',
            status: currentStep === 2 ? 'process' : currentStep > 2 ? 'finish' : 'wait',
          },
          {
            title: '选择模型',
            description: '',
            status: currentStep === 3 ? 'process' : currentStep > 3 ? 'finish' : 'wait',
          },
        ]}
      />
      
      <div style={{ marginTop: 24, padding: 16, border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #f0f0f0', borderRadius: 8 }}>
        {currentStep === 0 && (
          <div>
            <h3>选择AI服务提供商</h3>
            <p>请从下面列表中选择一个AI服务提供商：</p>
            <Select 
              value={selectedProviderId} 
              onChange={handleProviderChange}
              style={{ width: '100%' }}
              optionLabelProp="label"
              dropdownStyle={{ maxHeight: 400 }}
              showSearch
              optionFilterProp="children"
              className={isDarkMode ? 'dark-select' : ''}
            >
              {DEFAULT_AI_PROVIDERS.map(provider => (
                <Option 
                  key={provider.id} 
                  value={provider.id} 
                  label={provider.name}
                >
                  <Space>
                    <RobotOutlined style={{ color: isDarkMode ? '#1890ff' : '#1677ff' }} />
                    <span>{provider.name}</span>
                    {provider.id === 'Copy2AI' && (
                      <Tag color="green">免费版</Tag>
                    )}
                    {provider.website && (
                      <a 
                        href={provider.website} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <LinkOutlined />
                      </a>
                    )}
                  </Space>
                </Option>
              ))}
            </Select>
            {selectedProvider?.description && (
              <Alert
                message={selectedProvider.description}
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
                style={{ 
                  marginTop: 16,
                  background: isDarkMode ? 'rgba(24, 144, 255, 0.1)' : 'rgba(230, 244, 255, 0.8)',
                  border: isDarkMode ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid #d9e8ff'
                }}
              />
            )}
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button type="primary" onClick={nextStep}>
                下一步 <CaretRightOutlined />
              </Button>
            </div>
          </div>
        )}
        
        {currentStep === 1 && (
          <div>
            <h3>配置API密钥</h3>
            {selectedProviderId === 'Copy2AI' ? (
              <div>
                <Alert
                  message="默认免费AI，无需输入API密钥"
                  description="该服务由Copy2AI提供，您可以直接使用"
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  style={{ 
                    marginBottom: 16,
                    background: isDarkMode ? 'rgba(82, 196, 26, 0.1)' : 'rgba(246, 255, 237, 0.8)',
                    border: isDarkMode ? '1px solid rgba(82, 196, 26, 0.3)' : '1px solid #b7eb8f'
                  }}
                />
              </div>
            ) : (
              <p>
                {selectedProvider?.requiresApiKey 
                  ? '请输入您的API密钥：' 
                  : '此服务提供商不需要API密钥，您可以直接进行下一步。'}
              </p>
            )}
            
            {selectedProviderId !== 'Copy2AI' && (
              <Input.Password
                prefix={<KeyOutlined />}
                value={providerSettings.api_key}
                onChange={handleApiKeyChange}
                placeholder={selectedProvider?.requiresApiKey ? "输入API Key" : "此提供商不需要API Key"}
                disabled={!selectedProvider?.requiresApiKey}
                className={isDarkMode ? 'dark-input' : ''}
                style={{ marginBottom: 16 }}
              />
            )}
            
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={prevStep}>
                上一步
              </Button>
              <Button type="primary" onClick={nextStep}>
                下一步 <CaretRightOutlined />
              </Button>
            </div>
          </div>
        )}
        
        {currentStep === 2 && (
          <div>
            <h3>测试API连接</h3>
            <Form.Item 
              label={<Space><LinkOutlined /> 自定义测试 API 地址 (可选)</Space>}
              tooltip="如果服务商要求或允许，可在此处输入自定义的 API 地址进行测试。修改后会自动保存。"
              style={{ marginBottom: 16 }}
            >
              <Input 
                value={providerSettings.custom_api_base_url || ''}
                onChange={handleApiUrlChange}
                placeholder={selectedProvider?.apiBaseUrl || "输入自定义 API 地址，失去焦点后自动保存"}
                className={isDarkMode ? 'dark-input' : ''}
                prefix={<ApiOutlined />}
              />
            </Form.Item>
            
            <p>点击下方按钮测试与AI服务的连接 (将使用上方地址或默认地址):</p>
            <Button 
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleTestConnection}
              loading={testResult.loading}
              style={{ marginBottom: 16 }}
            >
              测试API连接
            </Button>
            
            {testResult.success !== undefined && (
              <Alert
                message={testResult.success ? "连接成功" : "连接失败"}
                description={testResult.message}
                type={testResult.success ? "success" : "error"}
                showIcon
                style={{ 
                  marginTop: 16,
                  background: testResult.success
                    ? (isDarkMode ? 'rgba(82, 196, 26, 0.1)' : 'rgba(246, 255, 237, 0.8)')
                    : (isDarkMode ? 'rgba(255, 77, 79, 0.1)' : 'rgba(255, 241, 240, 0.8)'),
                  border: testResult.success
                    ? (isDarkMode ? '1px solid rgba(82, 196, 26, 0.3)' : '1px solid #b7eb8f')
                    : (isDarkMode ? '1px solid rgba(255, 77, 79, 0.3)' : '1px solid #ffccc7')
                }}
              />
            )}
            
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={prevStep}>
                上一步
              </Button>
              <Button 
                type="primary" 
                onClick={nextStep}
                disabled={testResult.success === undefined || testResult.success === false}
              >
                下一步 <CaretRightOutlined />
              </Button>
            </div>
          </div>
        )}
        
        {currentStep === 3 && (
          <div>
            <h3>选择模型</h3>
            {selectedProviderId === 'Copy2AI' ? (
              <Alert
                message="默认免费AI模型已预设"
                description="该模型由Copy2AI提供，已预设最佳模型，无需手动选择"
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                style={{ 
                  marginBottom: 16,
                  background: isDarkMode ? 'rgba(82, 196, 26, 0.1)' : 'rgba(246, 255, 237, 0.8)',
                  border: isDarkMode ? '1px solid rgba(82, 196, 26, 0.3)' : '1px solid #b7eb8f'
                }}
              />
            ) : (
              <>
                {selectedProvider?.supportsModelsList ? (
                  <>
                    <p>您可以加载可用模型列表或直接输入模型名称：</p>
                    <Button 
                      type="primary"
                      icon={<SyncOutlined spin={loadingModels} />}
                      onClick={loadModels}
                      loading={loadingModels}
                      style={{ marginBottom: 16 }}
                    >
                      加载模型列表
                    </Button>
                  </>
                ) : (
                  <p>请从默认模型中选择或输入自定义模型名称：</p>
                )}
                
                <div style={{ marginTop: 16, marginBottom: 16 }}>
                  <Select
                    value={getSelectedModelValue()}
                    onChange={handleModelChange}
                    style={{ width: '100%' }}
                    showSearch
                    placeholder="选择模型或输入自定义模型名称"
                    optionFilterProp="children"
                    className={isDarkMode ? 'dark-select' : ''}
                    dropdownStyle={{ maxHeight: 400 }}
                    allowClear
                    showArrow
                    mode="tags"
                    tokenSeparators={[',']}
                    removeIcon={<CloseCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)' }} />}
                    maxTagCount={5}
                  >
                    {getModelOptions()}
                  </Select>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">提示：您可以选择现有模型或直接输入自定义模型名称，输入后回车确认。</Text>
                  </div>
                </div>
              </>
            )}
            
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={prevStep}>
                上一步
              </Button>
              <Button type="primary" onClick={() => setCurrentStep(0)}>
                完成设置
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AISettings: React.FC = () => {
  // 获取主题上下文
  const { isDarkMode } = useTheme();

  // 获取AI设置状态
  const { 
    settings, 
    isLoading, 
    updateSettings, 
    updateProviderSettings, 
    loadModels, 
    testConnection,
    saveSettings
  } = useAISettingsStore();
  
  // 本地状态
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    loading: boolean;
  }>({ loading: false });
  const [loadingModels, setLoadingModels] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<string>('');
  
  // 当前选中的提供商ID
  const selectedProviderId = settings.selected_provider_id;
  
  // 当前提供商信息
  const selectedProvider = DEFAULT_AI_PROVIDERS.find(p => p.id === selectedProviderId);
  
  // 当前提供商设置
  const providerSettings = (settings.providers[selectedProviderId] || {}) as AIProviderSettings;
  
  // 用于跟踪用户是否更改了设置
  const [hasChanges, setHasChanges] = useState(false);
  
  // 提供商设置映射，方便访问
  const providerSettingsMap = useMemo(() => {
    return settings.providers || {};
  }, [settings.providers]);
  
  // 当前提供商设置，方便访问
  const currentProviderSettings = providerSettingsMap[selectedProviderId] || {};
  
  // 处理提供商变更
  const handleProviderChange = (value: string) => {
    updateSettings({ selected_provider_id: value });
  };
  
  // 处理API地址变更
  const handleApiUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateProviderSettings(selectedProviderId, { custom_api_base_url: e.target.value });
  };
  
  // 处理模型变更
  const handleModelChange = (value: string | string[]) => {
    // 处理输入可能是数组的情况(tags模式)
    if (!Array.isArray(value)) {
      // 如果不是数组，直接更新选择的模型
      updateProviderSettings(selectedProviderId, { selected_model: value });
      return;
    }
    
    // 获取当前的动态模型列表
    const currentDynamicModels = [...(providerSettings.dynamic_models || [])];
    
    // 检查是否有新增的模型
    value.forEach(model => {
      const isDefaultModel = selectedProvider?.defaultModels?.includes(model);
      // 如果不是默认模型且不在当前动态模型列表中，则添加到动态模型列表
      if (!isDefaultModel && !currentDynamicModels.includes(model)) {
        currentDynamicModels.push(model);
      }
    });
    
    // 检查是否有需要删除的模型(从动态模型列表中移除但不在默认列表中的模型)
    const modelsToKeep = currentDynamicModels.filter(model => {
      // 如果该模型在value中，或者是默认模型，则保留
      return value.includes(model) || selectedProvider?.defaultModels?.includes(model);
    });
    
    // 更新动态模型列表和选中的模型
    updateProviderSettings(selectedProviderId, { 
      dynamic_models: modelsToKeep,
      selected_model: value.length > 0 ? value[value.length - 1] : (selectedProvider?.defaultModels?.[0] || 'default')
    });
    
    // 如果有变化，显示通知
    if (currentDynamicModels.length !== modelsToKeep.length) {
      message.success(`自定义模型列表已更新`);
    }
  };
  
  // 处理API Key变更
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateProviderSettings(selectedProviderId, { api_key: e.target.value });
  };
  
  // 处理模型列表URL变更
  const handleModelsUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateProviderSettings(selectedProviderId, { models_list_url: e.target.value });
  };
  
  // 加载模型列表
  const handleLoadModels = async () => {
    if (!selectedProvider) return;
    
    setLoadingModels(true);
    try {
      const models = await loadModels(selectedProviderId);
      if (models.length > 0) {
        message.success(`成功加载 ${models.length} 个模型，请选择您需要的模型`);
      } else {
        message.warning('未找到可用模型');
      }
    } catch (error) {
      message.error('加载模型列表失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoadingModels(false);
    }
  };
  
  // 测试API连接
  const handleTestConnection = async () => {
    setTestResult({ loading: true });
    try {
      // 获取当前选择的模型，确保是字符串而不是数组
      const modelValue = Array.isArray(providerSettings.selected_model) 
        ? providerSettings.selected_model[0] 
        : providerSettings.selected_model;
      
      const result = await testConnection(selectedProviderId);
      setTestResult({
        success: result.success,
        message: result.message,
        loading: false
      });
      if (result.success) {
        message.success('连接成功，请选择或加载模型');
      } else {
        message.error('连接失败: ' + result.message);
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: '测试过程中出错: ' + (error instanceof Error ? error.message : String(error)),
        loading: false
      });
      message.error('测试失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };
  
  // 保存设置
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await saveSettings();
      message.success('设置已保存');
      setHasChanges(false);
    } catch (error) {
      message.error(`保存设置失败: ${error}`);
    } finally {
      setSavingSettings(false);
    }
  };
  
  // 获取可选模型列表
  const getModelOptions = () => {
    const defaultModels = selectedProvider?.defaultModels || [];
    const dynamicModels = providerSettings.dynamic_models || [];
    
    // 合并默认模型和动态加载的模型，去重
    const allModels = [...new Set([...defaultModels, ...dynamicModels])];
    
    // 如果没有任何模型，添加一个默认占位符
    if (allModels.length === 0) {
      return [
        <Option key="default" value="default">默认模型</Option>
      ];
    }
    
    return allModels.map(model => {
      // 标记是默认模型还是自定义模型
      const isDefaultModel = defaultModels.includes(model);
      const isDynamicModel = dynamicModels.includes(model);
      
      return (
        <Option key={model} value={model}>
          <Space>
            <span>{model}</span>
            {isDefaultModel && <Tag color="blue" style={{ marginLeft: 4 }}>默认</Tag>}
            {isDynamicModel && !isDefaultModel && <Tag color="green" style={{ marginLeft: 4 }}>自定义</Tag>}
          </Space>
        </Option>
      );
    });
  };
  
  // 获取当前选中的模型值，确保有有效值
  const getSelectedModelValue = () => {
    const selectedModel = providerSettings.selected_model;
    
    // 对于多选模式，需要返回一个数组
    // 但由于我们只保存一个选中的模型，需要将其转换为数组
    if (selectedModel) {
      return [selectedModel];
    }
    
    // 如果没有设置的模型值，使用第一个默认模型
    const defaultModels = selectedProvider?.defaultModels || [];
    if (defaultModels.length > 0) {
      return [defaultModels[0]];
    }
    
    // 最坏情况下返回 ['default']
    return ['default'];
  };
  
  // 渲染测试状态标签
  const renderTestStatusTag = () => {
    const { last_test_time, test_success } = providerSettings;
    
    if (!last_test_time) return null;
    
    const testTime = new Date(last_test_time).toLocaleString();
    
    return (
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ marginRight: 8 }}>上次测试: {testTime}</Text>
        {test_success ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>连接成功</Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleOutlined />}>连接失败</Tag>
        )}
      </div>
    );
  };

  // 显示当前AI配置信息
  const showCurrentConfig = () => {
    const currentProviderSetting = settings.providers[selectedProviderId];
    const currentProvider = DEFAULT_AI_PROVIDERS.find(p => p.id === selectedProviderId);

    if (!currentProviderSetting || !currentProvider) {
      message.error('无法获取当前配置信息');
      return;
    }

    // 收集所有模型信息
    const defaultModels = currentProvider.defaultModels || [];
    const dynamicModels = currentProviderSetting.dynamic_models || [];
    const allModels = [...new Set([...defaultModels, ...dynamicModels])];

    const config = {
      provider: {
        id: currentProvider.id,
        name: currentProvider.name,
        apiBaseUrl: currentProvider.apiBaseUrl,
        supportsModelsList: currentProvider.supportsModelsList,
        requiresApiKey: currentProvider.requiresApiKey,
        description: currentProvider.description,
        website: currentProvider.website
      },
      settings: {
        custom_api_base_url: currentProviderSetting.custom_api_base_url,
        selected_model: currentProviderSetting.selected_model,
        api_key: currentProviderSetting.api_key ? '******' : undefined,
        temperature: currentProviderSetting.temperature,
        max_tokens: currentProviderSetting.max_tokens,
        use_stream: currentProviderSetting.use_stream,
        availableModels: allModels,
        dynamic_models: currentProviderSetting.dynamic_models,
        last_test_time: currentProviderSetting.last_test_time 
          ? new Date(currentProviderSetting.last_test_time).toLocaleString() 
          : undefined,
        test_success: currentProviderSetting.test_success
      }
    };

    setCurrentConfig(JSON.stringify(config, null, 2));
    setConfigVisible(true);
  };

  // 复制配置到剪贴板
  const copyConfigToClipboard = async () => {
    try {
      // 对于桌面应用，优先使用Tauri API
      if ('__TAURI__' in window) {
        await invoke('copy_to_clipboard', { content: currentConfig });
        message.success('已复制到剪贴板');
      } else {
        // 浏览器环境退回到Web API
        await navigator.clipboard.writeText(currentConfig);
        message.success('已复制到剪贴板');
      }
    } catch (error) {
      console.error('复制失败', error);
      message.error('复制失败: ' + (error instanceof Error ? error.message : String(error)));
      
      // 尝试使用备用方法
      try {
        const textarea = document.createElement('textarea');
        textarea.value = currentConfig;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        message.success('已使用备用方法复制到剪贴板');
      } catch (fallbackError) {
        message.error('所有复制方法都失败了');
      }
    }
  };
  
  // 处理最大token数变更，确保值总是有效的
  const handleMaxTokensChange = (value: number | null) => {
    // 如果值无效，使用默认值
    const tokenValue = typeof value === 'number' && !isNaN(value) ? value : 2048;
    updateProviderSettings(selectedProviderId, { max_tokens: tokenValue });
  };

  // 处理temperature变更，确保值总是有效的
  const handleTemperatureChange = (value: number | null) => {
    // 如果值无效，使用默认值
    const tempValue = typeof value === 'number' && !isNaN(value) ? value : 0.7;
    updateProviderSettings(selectedProviderId, { temperature: tempValue });
  };

  // 处理流式输出变更
  const handleStreamChange = (checked: boolean) => {
    updateProviderSettings(selectedProviderId, { use_stream: checked });
  };

  // 渲染提供商卡片底部的操作按钮
  const renderCardActions = () => {
    return [
      <Button 
        key="test" 
        onClick={handleTestConnection}
        icon={<SyncOutlined spin={testResult.loading} />}
        loading={testResult.loading}
        disabled={!selectedProvider?.apiBaseUrl && !providerSettings.custom_api_base_url}
      >
        测试API连接
      </Button>
    ];
  };

  return (
    <div className="ai-settings-page" style={{ padding: '24px' }}>
      <Card 
        title={
          <Space>
            <RobotOutlined style={{ fontSize: '20px', color: isDarkMode ? '#1890ff' : '#1677ff' }} />
            <span>AI服务设置</span>
          </Space>
        } 
        bordered={false}
        className="glass-container"
        style={{ 
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: isDarkMode 
            ? '0 8px 24px rgba(0, 0, 0, 0.2)' 
            : '0 8px 24px rgba(0, 0, 0, 0.08)',
          background: isDarkMode 
            ? `linear-gradient(135deg, rgba(24, 24, 28, 0.95), rgba(36, 36, 42, 0.98))` 
            : `linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 252, 0.95))`,
        }}
        extra={
          <Space>
            <Button 
              icon={<CopyOutlined />}
              onClick={showCurrentConfig}
              type="default"
              className={isDarkMode ? 'dark-button' : ''}
            >
              查看配置
            </Button>
            {renderCardActions()}
          </Space>
        }
      >
        <Spin spinning={isLoading} tip="加载中...">
          {/* 添加AI服务设置流程 */}
          <AISetupFlow
            selectedProviderId={selectedProviderId}
            providerSettings={providerSettings}
            handleProviderChange={handleProviderChange}
            handleApiKeyChange={handleApiKeyChange}
            handleTestConnection={handleTestConnection}
            testResult={testResult}
            loadModels={handleLoadModels}
            loadingModels={loadingModels}
            isDarkMode={isDarkMode}
            getSelectedModelValue={getSelectedModelValue}
            handleModelChange={handleModelChange}
            getModelOptions={getModelOptions}
            handleApiUrlChange={handleApiUrlChange}
          />
          
          <Tabs 
            defaultActiveKey="basic"
            type="card"
            className={isDarkMode ? 'dark-tabs' : ''}
            items={[
              {
                key: 'basic',
                label: '基本设置',
                children: (
                  <Form layout="vertical" className={isDarkMode ? 'dark-form' : ''}>
                    <Row gutter={24}>
                      <Col xs={24} md={12}>
                        <Form.Item 
                          label={
                            <Space>
                              <span>AI服务提供商</span>
                              <Tooltip title="选择AI服务提供商">
                                <QuestionCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }} />
                              </Tooltip>
                            </Space>
                          }
                        >
                          <Select 
                            value={selectedProviderId} 
                            onChange={handleProviderChange}
                            style={{ width: '100%' }}
                            optionLabelProp="label"
                            dropdownStyle={{ maxHeight: 400 }}
                            showSearch
                            optionFilterProp="children"
                            className={isDarkMode ? 'dark-select' : ''}
                          >
                            {DEFAULT_AI_PROVIDERS.map(provider => (
                              <Option 
                                key={provider.id} 
                                value={provider.id} 
                                label={provider.name}
                              >
                                <Space>
                                  <RobotOutlined style={{ color: isDarkMode ? '#1890ff' : '#1677ff' }} />
                                  <span>{provider.name}</span>
                                  {provider.id === 'Copy2AI' && (
                                    <Tag color="green">免费版</Tag>
                                  )}
                                  {provider.website && (
                                    <a 
                                      href={provider.website} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <LinkOutlined />
                                    </a>
                                  )}
                                </Space>
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                        
                        {selectedProvider?.description && (
                          <Alert
                            message={selectedProvider.description}
                            type="info"
                            showIcon
                            icon={<InfoCircleOutlined />}
                            style={{ 
                              marginBottom: 16,
                              background: isDarkMode ? 'rgba(24, 144, 255, 0.1)' : 'rgba(230, 244, 255, 0.8)',
                              border: isDarkMode ? '1px solid rgba(24, 144, 255, 0.3)' : '1px solid #d9e8ff'
                            }}
                          />
                        )}
                        
                        <Form.Item 
                          label={
                            <Space>
                              <span>API地址</span>
                              <Tooltip title="API服务的基础URL，通常以/v1结尾">
                                <QuestionCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }} />
                              </Tooltip>
                            </Space>
                          }
                          style={{ display: selectedProviderId === 'Copy2AI' ? 'none' : 'block' }}
                        >
                          <Input
                            prefix={<ApiOutlined />}
                            value={providerSettings.custom_api_base_url || selectedProvider?.apiBaseUrl}
                            onChange={handleApiUrlChange}
                            placeholder="输入API基础地址"
                            className={isDarkMode ? 'dark-input' : ''}
                          />
                        </Form.Item>
                        
                        <Form.Item 
                          label={
                            <Space>
                              <span>API Key</span>
                              <Tooltip title="API服务所需的密钥">
                                <QuestionCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }} />
                              </Tooltip>
                            </Space>
                          }
                          style={{ display: selectedProviderId === 'Copy2AI' ? 'none' : 'block' }}
                        >
                          <Input.Password
                            prefix={<KeyOutlined />}
                            value={providerSettings.api_key}
                            onChange={handleApiKeyChange}
                            placeholder={selectedProvider?.requiresApiKey ? "输入API Key" : "此提供商不需要API Key"}
                            disabled={!selectedProvider?.requiresApiKey}
                            className={isDarkMode ? 'dark-input' : ''}
                          />
                        </Form.Item>

                        {selectedProviderId === 'Copy2AI' && (
                          <Alert
                            message="默认免费AI，无需输入API密钥"
                            description="该服务由Copy2AI提供，已预设API密钥，您可以直接使用"
                            type="success"
                            showIcon
                            icon={<CheckCircleOutlined />}
                            style={{ 
                              marginBottom: 16,
                              background: isDarkMode ? 'rgba(82, 196, 26, 0.1)' : 'rgba(246, 255, 237, 0.8)',
                              border: isDarkMode ? '1px solid rgba(82, 196, 26, 0.3)' : '1px solid #b7eb8f'
                            }}
                          />
                        )}
                      </Col>
                      
                      <Col xs={24} md={12}>
                        <Form.Item 
                          label={
                            <Space>
                              <span>选择模型（自动保存）</span>
                              <Tooltip title="选中模型后，可同步应用到AI对话功能">
                                <QuestionCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }} />
                              </Tooltip>
                            </Space>
                          }
                          style={{ display: selectedProviderId === 'Copy2AI' ? 'none' : 'block' }}
                        >
                          <Select
                            value={getSelectedModelValue()}
                            onChange={handleModelChange}
                            style={{ width: '100%' }}
                            showSearch
                            placeholder="选择模型或输入自定义模型名称"
                            optionFilterProp="children"
                            className={isDarkMode ? 'dark-select' : ''}
                            dropdownStyle={{ maxHeight: 400 }}
                            allowClear
                            showArrow
                            mode="tags"
                            tokenSeparators={[',']}
                            removeIcon={<CloseCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)' }} />}
                            maxTagCount={5}
                          >
                            {getModelOptions()}
                          </Select>
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary">提示：您可以选择现有模型或直接输入自定义模型名称，自定义模型可删除。</Text>
                          </div>
                        </Form.Item>
                        
                        {selectedProvider?.supportsModelsList && (
                          <>
                            <Form.Item 
                              label={
                                <Space>
                                  <span>手动输入模型或者通过API加载模型</span>
                                  <Tooltip title="用于获取可用模型列表的API地址">
                                    <QuestionCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }} />
                                  </Tooltip>
                                </Space>
                              }
                            >
                              <Input
                                value={providerSettings.models_list_url || selectedProvider?.modelsListUrl}
                                onChange={handleModelsUrlChange}
                                placeholder="输入模型列表API地址"
                                className={isDarkMode ? 'dark-input' : ''}
                                addonAfter={
                                  <Button 
                                    type="link" 
                                    size="small" 
                                    onClick={handleLoadModels}
                                    loading={loadingModels}
                                    icon={<ThunderboltOutlined />}
                                  >
                                    加载模型
                                  </Button>
                                }
                              />
                            </Form.Item>
                            
                            {providerSettings.dynamic_models && providerSettings.dynamic_models.length > 0 && (
                              <Alert
                                message={`已加载 ${providerSettings.dynamic_models.length} 个模型`}
                                type="success"
                                showIcon
                                style={{ 
                                  marginBottom: 16,
                                  background: isDarkMode ? 'rgba(82, 196, 26, 0.1)' : 'rgba(246, 255, 237, 0.8)',
                                  border: isDarkMode ? '1px solid rgba(82, 196, 26, 0.3)' : '1px solid #b7eb8f'
                                }}
                              />
                            )}
                          </>
                        )}
                        
                        {renderTestStatusTag()}
                        
                        {testResult.success !== undefined && (
                          <Alert
                            message={testResult.success ? "连接成功" : "连接失败"}
                            description={testResult.message}
                            type={testResult.success ? "success" : "error"}
                            showIcon
                            style={{ 
                              marginTop: 16,
                              background: testResult.success
                                ? (isDarkMode ? 'rgba(82, 196, 26, 0.1)' : 'rgba(246, 255, 237, 0.8)')
                                : (isDarkMode ? 'rgba(255, 77, 79, 0.1)' : 'rgba(255, 241, 240, 0.8)'),
                              border: testResult.success
                                ? (isDarkMode ? '1px solid rgba(82, 196, 26, 0.3)' : '1px solid #b7eb8f')
                                : (isDarkMode ? '1px solid rgba(255, 77, 79, 0.3)' : '1px solid #ffccc7')
                            }}
                          />
                        )}
                      </Col>
                    </Row>
                  </Form>
                )
              },
              {
                key: 'advanced',
                label: '高级设置',
                children: (
                  <Form layout="vertical" className={isDarkMode ? 'dark-form' : ''}>
                    <Row gutter={24}>
                      <Col xs={24} md={8}>
                        <Form.Item 
                          label={
                            <Space>
                              <span>Temperature (随机性)</span>
                              <Tooltip title="值越高，生成内容越随机，值越低，生成内容越确定">
                                <QuestionCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }} />
                              </Tooltip>
                            </Space>
                          }
                        >
                          <InputNumber
                            min={0}
                            max={2}
                            step={0.1}
                            value={providerSettings.temperature}
                            onChange={handleTemperatureChange}
                            style={{ width: '100%' }}
                            className={isDarkMode ? 'dark-input-number' : ''}
                          />
                        </Form.Item>
                      </Col>
                      
                      <Col xs={24} md={8}>
                        <Form.Item 
                          label={
                            <Space>
                              <span>最大Token数</span>
                              <Tooltip title="生成内容的最大token数">
                                <QuestionCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }} />
                              </Tooltip>
                            </Space>
                          }
                        >
                          <InputNumber
                            min={100}
                            max={16000}
                            step={100}
                            value={providerSettings.max_tokens}
                            onChange={handleMaxTokensChange}
                            style={{ width: '100%' }}
                            className={isDarkMode ? 'dark-input-number' : ''}
                          />
                        </Form.Item>
                      </Col>
                      
                      <Col xs={24} md={8}>
                        <Form.Item 
                          label={
                            <Space>
                              <span>使用流式输出</span>
                              <Tooltip title="启用后，会使用流式API，实现打字机效果">
                                <QuestionCircleOutlined style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }} />
                              </Tooltip>
                            </Space>
                          }
                        >
                          <Switch
                            checked={providerSettings.use_stream}
                            onChange={handleStreamChange}
                            className={isDarkMode ? 'dark-switch' : ''}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    
                    <Divider orientation="left">提供商设置</Divider>
                    
                    <List
                      className={isDarkMode ? 'dark-list' : ''}
                      grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 3 }}
                      dataSource={DEFAULT_AI_PROVIDERS}
                      renderItem={provider => {
                        const providerConfig = settings.providers[provider.id];
                        const isConfigured = providerConfig && providerConfig.api_key;
                        const isSelected = selectedProviderId === provider.id;
                        
                        // 获取当前选择的模型名称
                        const selectedModelName = providerConfig?.selected_model 
                          ? (Array.isArray(providerConfig.selected_model) 
                            ? providerConfig.selected_model[0] 
                            : providerConfig.selected_model)
                          : (provider.defaultModels && provider.defaultModels.length > 0 
                            ? provider.defaultModels[0] 
                            : '默认');
                        
                        return (
                          <List.Item>
                            <Card
                              hoverable
                              className={`provider-card ${isDarkMode ? 'dark-card' : ''} ${isSelected ? 'selected-card' : ''}`}
                              size="small"
                              style={{
                                borderRadius: '8px',
                                borderColor: isSelected 
                                  ? (isDarkMode ? '#1890ff' : '#1677ff') 
                                  : (isDarkMode ? '#303030' : '#f0f0f0'),
                                background: isSelected
                                  ? (isDarkMode ? 'rgba(24, 144, 255, 0.1)' : 'rgba(24, 144, 255, 0.05)')
                                  : (isDarkMode ? 'rgba(42, 42, 46, 0.8)' : 'white')
                              }}
                              title={
                                <Space>
                                  <Badge 
                                    status={isConfigured ? 'success' : 'default'} 
                                    dot={true}
                                  />
                                  <span>{provider.name}</span>
                                  {isConfigured && (
                                    <Tag color="success" style={{ marginLeft: 4 }}>已配置</Tag>
                                  )}
                                </Space>
                              }
                              actions={[
                                <Button 
                                  key="edit" 
                                  type={isSelected ? 'primary' : 'default'}
                                  size="small"
                                  icon={<EditOutlined />}
                                  onClick={() => handleProviderChange(provider.id)}
                                >
                                  {isSelected ? '当前选择' : '选择'}
                                </Button>
                              ]}
                            >
                              <div style={{ minHeight: '60px' }}>
                                <div style={{ height: '40px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '8px' }}>
                                  {provider.description || '没有描述'}
                                </div>
                                {isConfigured && (
                                  <div>
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                      当前模型: <Tag color="blue">{selectedModelName}</Tag>
                                    </Text>
                                  </div>
                                )}
                              </div>
                            </Card>
                          </List.Item>
                        );
                      }}
                    />
                  </Form>
                )
              }
            ]}
          />
        </Spin>
      </Card>

      <Drawer
        title="当前AI配置信息"
        placement="right"
        onClose={() => setConfigVisible(false)}
        open={configVisible}
        width={480}
        extra={
          <Button type="primary" icon={<CopyOutlined />} onClick={copyConfigToClipboard}>
            复制
          </Button>
        }
      >
        <div style={{ background: isDarkMode ? '#1e1e1e' : '#f5f5f5', padding: '16px', borderRadius: '4px', overflow: 'auto' }}>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <code>{currentConfig}</code>
          </pre>
        </div>
      </Drawer>

      <div style={{ textAlign: 'center', marginTop: 24, marginBottom: 12, color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}>
        <div>AI连接功能由 <a href="http://LocalAPI.ai" target="_blank" rel="noreferrer">LocalAPI.ai</a> 提供技术支持</div>
      </div>

      <style>{`
        .dark-button {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.85);
        }
        .dark-button:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.95);
        }
        .dark-input {
          background-color: rgba(0, 0, 0, 0.25);
          border-color: rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.85);
        }
        .dark-input-number {
          background-color: rgba(0, 0, 0, 0.25);
          border-color: rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.85);
        }
        .dark-select .ant-select-selector {
          background-color: rgba(0, 0, 0, 0.25) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        .dark-switch {
          background-color: rgba(0, 0, 0, 0.25);
        }
        .dark-form label {
          color: rgba(255, 255, 255, 0.85);
        }
        .dark-tabs .ant-tabs-nav {
          margin-bottom: 24px;
        }
        .dark-tabs .ant-tabs-tab {
          background: rgba(0, 0, 0, 0.2);
          border-color: rgba(255, 255, 255, 0.1);
        }
        .dark-tabs .ant-tabs-tab-active {
          background: rgba(24, 144, 255, 0.1);
          border-color: #1890ff;
        }
        .dark-list .ant-list-item {
          border-color: rgba(255, 255, 255, 0.1);
        }
        .provider-card {
          transition: all 0.3s;
        }
        .selected-card {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
        }
      `}</style>
    </div>
  );
};

export default AISettings; 