import React, { useState, useEffect } from 'react';
import { Card, Typography, List, Avatar, Space, Tag, Tooltip } from 'antd';
import { CheckCircleFilled, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { AIProvider } from '../models/ai';

const { Text } = Typography;

interface AIProviderSelectorProps {
  onSelectProvider: (providerId: string, modelId: string) => void;
  selectedProviderId?: string;
  selectedModelId?: string;
}

const getProviderIcon = (providerId: string): string => {
  const icons: Record<string, string> = {
    openai: '🟢',
    anthropic: '🟣',
    gemini: '🔵',
    mistral: '🔴',
    azure: '🔷',
    ollama: '🟠',
    custom: '🟡',
  };
  return icons[providerId] || '🤖';
};

const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({
  onSelectProvider,
  selectedProviderId,
  selectedModelId,
}) => {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 加载AI提供商列表
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setLoading(true);
        const result = await invoke<AIProvider[]>('get_ai_providers');
        setProviders(result);
        setError('');
      } catch (err) {
        console.error('Failed to load AI providers:', err);
        setError('加载AI提供商失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadProviders();
  }, []);
  
  const handleProviderSelect = (providerId: string, modelId: string) => {
    onSelectProvider(providerId, modelId);
  };
  
  // 判断提供商是否配置有效
  const isProviderConfigured = (provider: AIProvider): boolean => {
    return !!(provider as any).api_key || provider.id === 'ollama';
  };
  
  // 渲染模型列表
  const renderModelList = (provider: AIProvider) => {
    if (!(provider as any).models || (provider as any).models.length === 0) {
      return (
        <div style={{ padding: '8px 0' }}>
          <Text type="secondary">无可用模型</Text>
        </div>
      );
    }
    
    return (
      <List
        size="small"
        dataSource={(provider as any).models}
        renderItem={(model: any) => {
          const isSelected = selectedProviderId === provider.id && selectedModelId === model.id;
          
          return (
            <List.Item
              onClick={() => handleProviderSelect(provider.id, model.id)}
              style={{ 
                cursor: 'pointer',
                backgroundColor: isSelected ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                borderRadius: '4px',
                padding: '8px 12px',
              }}
            >
              <Space>
                {isSelected && (
                  <CheckCircleFilled style={{ color: '#1890ff' }} />
                )}
                <Text
                  style={{ 
                    marginLeft: isSelected ? '0' : '24px',
                    fontWeight: isSelected ? 500 : 'normal',
                  }}
                >
                  {model.name}
                </Text>
                {model.tags && model.tags.map(tag => (
                  <Tag key={tag} color="blue" style={{ marginRight: 0 }}>
                    {tag}
                  </Tag>
                ))}
              </Space>
            </List.Item>
          );
        }}
      />
    );
  };
  
  if (loading) {
    return <div>加载中...</div>;
  }
  
  if (error) {
    return <div>错误: {error}</div>;
  }
  
  return (
    <div className="ai-provider-selector">
      <Space direction="vertical" style={{ width: '100%' }}>
        {providers.map(provider => {
          const isConfigured = isProviderConfigured(provider);
          
          return (
            <Card
              key={provider.id}
              size="small"
              title={
                <Space>
                  <Avatar size="small" style={{ backgroundColor: '#f0f0f0' }}>
                    {getProviderIcon(provider.id)}
                  </Avatar>
                  <Text strong>{provider.name}</Text>
                  {!isConfigured && (
                    <Tooltip title="API密钥未配置">
                      <WarningOutlined style={{ color: '#faad14' }} />
                    </Tooltip>
                  )}
                </Space>
              }
              style={{ 
                marginBottom: '16px',
                opacity: isConfigured ? 1 : 0.6,
              }}
              extra={
                <Tooltip title={isConfigured ? "点击配置" : "请先配置API密钥"}>
                  <InfoCircleOutlined style={{ cursor: 'pointer' }} />
                </Tooltip>
              }
            >
              {isConfigured ? (
                renderModelList(provider)
              ) : (
                <div style={{ padding: '8px 0', textAlign: 'center' }}>
                  <Text type="secondary">请先在设置中配置API密钥</Text>
                </div>
              )}
            </Card>
          );
        })}
      </Space>
    </div>
  );
};

export default AIProviderSelector; 