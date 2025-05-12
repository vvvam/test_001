import React, { useState } from 'react';
import { Row, Col, Card, Typography, Tabs, Input, Empty } from 'antd';
import { SearchOutlined, CheckCircleFilled } from '@ant-design/icons';
import { DEFAULT_AI_PROVIDERS } from '../constants/aiProviders';
import { AIProvider } from '../models/ai';

const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface ModelSelectionGridProps {
  onSelectProvider: (providerId: string) => void;
  selectedProviderId?: string;
}

/**
 * 模型选择网格组件
 * 用于在聊天页面和设置页面中选择AI模型提供商
 */
const ModelSelectionGrid: React.FC<ModelSelectionGridProps> = ({
  onSelectProvider,
  selectedProviderId
}) => {
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // 根据搜索文本和当前标签页过滤提供商
  const filteredProviders = DEFAULT_AI_PROVIDERS.filter(provider => {
    // 匹配搜索文本
    const matchesSearch = searchText === '' || 
      provider.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (provider.description || '').toLowerCase().includes(searchText.toLowerCase());
    
    // 匹配标签页  
    const matchesTab = activeTab === 'all' || 
      (activeTab === 'local' && !provider.requiresApiKey) ||
      (activeTab === 'remote' && provider.requiresApiKey);
      
    return matchesSearch && matchesTab;
  });
  
  // 处理搜索文本变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };
  
  // 渲染空状态
  const renderEmptyState = () => (
    <Empty 
      description="未找到匹配的模型" 
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ margin: '32px 0' }}
    />
  );
  
  return (
    <div className="model-selection-grid">
      {/* 搜索框 */}
      <div className="search-container" style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索模型..."
          value={searchText}
          onChange={handleSearchChange}
          prefix={<SearchOutlined />}
          allowClear
        />
      </div>
      
      {/* 分类标签页 */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        style={{ marginBottom: 16 }}
      >
        <TabPane tab="全部模型" key="all" />
        <TabPane tab="本地模型" key="local" />
        <TabPane tab="远程API" key="remote" />
      </Tabs>
      
      {/* 模型提供商网格 */}
      {filteredProviders.length > 0 ? (
        <Row gutter={[16, 16]}>
          {filteredProviders.map(provider => (
            <Col xs={24} sm={12} md={8} key={provider.id}>
              <ProviderCard 
                provider={provider} 
                isSelected={selectedProviderId === provider.id}
                onSelect={() => onSelectProvider(provider.id)}
              />
            </Col>
          ))}
        </Row>
      ) : renderEmptyState()}
    </div>
  );
};

interface ProviderCardProps {
  provider: AIProvider;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * 提供商卡片组件
 * 在模型选择网格中显示单个AI提供商
 */
const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  isSelected,
  onSelect
}) => {
  return (
    <Card
      hoverable
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? '#1890ff' : undefined,
        background: isSelected ? 'rgba(24, 144, 255, 0.1)' : undefined
      }}
      onClick={onSelect}
      bodyStyle={{ padding: '16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* 提供商图标 */}
        <div 
          style={{ 
            fontSize: '24px', 
            marginRight: '16px',
            width: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            background: '#f0f0f0'
          }}
        >
          {getProviderIcon(provider.id)}
        </div>
        
        {/* 提供商信息 */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: '16px' }}>{provider.name}</Text>
            {isSelected && <CheckCircleFilled style={{ color: '#1890ff' }} />}
          </div>
          
          <Paragraph 
            ellipsis={{ rows: 2 }}
            type="secondary"
            style={{ fontSize: '12px', marginTop: '4px', marginBottom: 0 }}
          >
            {provider.description || `${provider.name} AI 模型`}
          </Paragraph>
          
          {/* 支持的模型列表 */}
          <div style={{ marginTop: '8px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {provider.defaultModels?.length 
                ? `支持模型: ${provider.defaultModels.slice(0, 3).join(', ')}${provider.defaultModels.length > 3 ? '...' : ''}`
                : '没有可用模型'
              }
            </Text>
          </div>
        </div>
      </div>
    </Card>
  );
};

/**
 * 根据提供商ID返回对应的图标
 */
function getProviderIcon(id: string): React.ReactNode {
  const icons: Record<string, string> = {
    'openai': '🤖',
    'anthropic': '🧠',
    'ollama': '🦙',
    'kimi': '✨',
    'dashscope': '🌐',
    'qianfan': '🚀',
    'baichuan': '🔮',
    'deepseek': '🔍',
    'default': '🤖'
  };
  
  return icons[id] || icons.default;
}

export default ModelSelectionGrid; 