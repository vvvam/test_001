import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Tabs, Input, Empty } from 'antd';
import { SearchOutlined, CheckCircleFilled } from '@ant-design/icons';
import useRoleStore from '../store/roleStore';
import { Role } from '../models/role';

const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface RoleSelectionGridProps {
  onSelectRole: (roleId: string) => void;
  selectedRoleId?: string;
}

/**
 * 角色选择网格组件
 * 用于在聊天页面和设置页面中选择AI角色
 */
const RoleSelectionGrid: React.FC<RoleSelectionGridProps> = ({
  onSelectRole,
  selectedRoleId
}) => {
  // 状态和store
  const { roles, loadRoles } = useRoleStore();
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // 加载角色列表
  useEffect(() => {
    loadRoles();
  }, [loadRoles]);
  
  // 根据搜索文本和当前标签页过滤角色
  const filteredRoles = roles.filter(role => {
    // 匹配搜索文本
    const matchesSearch = searchText === '' || 
      role.name.toLowerCase().includes(searchText.toLowerCase()) ||
      role.description.toLowerCase().includes(searchText.toLowerCase());
    
    // 匹配当前标签页  
    const matchesTab = 
      activeTab === 'all' || 
      (activeTab === 'common' && !role.is_custom) ||
      (activeTab === 'builtin' && !role.is_custom) ||
      (activeTab === 'custom' && role.is_custom);
      
    return matchesSearch && matchesTab;
  });
  
  // 处理搜索文本变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };
  
  // 渲染空状态
  const renderEmptyState = () => (
    <Empty 
      description="未找到匹配的角色" 
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ margin: '32px 0' }}
    />
  );
  
  return (
    <div className="role-selection-grid">
      {/* 搜索框 */}
      <div className="search-container" style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索角色..."
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
        <TabPane tab="全部角色" key="all" />
        <TabPane tab="常用角色" key="common" />
        <TabPane tab="内置角色" key="builtin" />
        <TabPane tab="自定义角色" key="custom" />
      </Tabs>
      
      {/* 角色网格 */}
      {filteredRoles.length > 0 ? (
        <Row gutter={[16, 16]}>
          {filteredRoles.map(role => (
            <Col xs={24} sm={12} md={8} key={role.id}>
              <RoleCard 
                role={role} 
                isSelected={selectedRoleId === role.id}
                onSelect={() => onSelectRole(role.id)}
                isDefault={(role as any).is_default}
              />
            </Col>
          ))}
        </Row>
      ) : renderEmptyState()}
    </div>
  );
};

interface RoleCardProps {
  role: Role;
  isSelected: boolean;
  onSelect: () => void;
  isDefault?: boolean;
}

/**
 * 角色卡片组件
 * 在角色选择网格中显示单个角色
 */
const RoleCard: React.FC<RoleCardProps> = ({
  role,
  isSelected,
  onSelect,
  isDefault
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
        {/* 角色图标 */}
        <div 
          style={{ 
            fontSize: '32px', 
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
          {role.icon}
        </div>
        
        {/* 角色信息 */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: '16px' }}>
              {role.name}
              {isDefault && <Text type="secondary" style={{ fontSize: '12px', marginLeft: '4px' }}>(默认)</Text>}
            </Text>
            
            {isSelected && <CheckCircleFilled style={{ color: '#1890ff' }} />}
          </div>
          
          <Paragraph 
            ellipsis={{ rows: 2 }}
            type="secondary"
            style={{ fontSize: '12px', marginTop: '4px', marginBottom: 0 }}
          >
            {role.description}
          </Paragraph>
        </div>
      </div>
    </Card>
  );
};

export default RoleSelectionGrid; 