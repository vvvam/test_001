import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Button, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CopyOutlined,
  MessageOutlined,
  UserOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { useAISettingsStore } from '../store/aiSettingsStore';

const { Sider } = Layout;
const { Title } = Typography;

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed_state';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['home']);
  const { isDarkMode } = useTheme();
  const { settings } = useAISettingsStore();
  
  // 从localStorage获取初始折叠状态
  const [collapsed, setCollapsed] = useState(() => {
    const savedState = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return savedState ? JSON.parse(savedState) : false;
  });
  
  // 添加鼠标悬停状态
  const [isHovering, setIsHovering] = useState(false);

  // 获取当前配置的提供商信息
  const currentProviderId = settings.selected_provider_id;
  const providerSettings = settings.providers[currentProviderId];
  const hasApiKey = providerSettings?.api_key && providerSettings.api_key.trim() !== '';

  useEffect(() => {
    const path = location.pathname;
    if (path === '/dashboard') setSelectedKeys(['dashboard']);
    else if (path === '/' || path === '/home') setSelectedKeys(['home']);
    else if (path === '/chat') setSelectedKeys(['chat']);
    else if (path === '/roles') setSelectedKeys(['roles']);
    else if (path === '/settings') setSelectedKeys(['settings']);
    else if (path === '/ai-settings') setSelectedKeys(['ai-settings']);
  }, [location]);
  
  // 切换折叠状态并保存到localStorage
  const toggleCollapsed = () => {
    const newCollapsedState = !collapsed;
    setCollapsed(newCollapsedState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(newCollapsedState));
  };

  // 鼠标悬停处理函数
  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: collapsed ? '' : '仪表盘',
      title: '仪表盘',
      onClick: () => navigate('/dashboard'),
    },
    {
      key: 'home',
      icon: <CopyOutlined />,
      label: collapsed ? '' : '剪贴板历史',
      title: '剪贴板历史',
      onClick: () => navigate('/home'),
    },
    {
      key: 'chat',
      icon: <MessageOutlined />,
      label: collapsed ? '' : 'AI 对话',
      title: 'AI 对话',
      onClick: () => navigate('/chat'),
    },
    {
      key: 'roles',
      icon: <UserOutlined />,
      label: collapsed ? '' : 'AI 角色管理',
      title: 'AI 角色管理',
      onClick: () => navigate('/roles'),
    },
    {
      key: 'ai-settings',
      icon: hasApiKey 
        ? <Badge status="success" dot><RobotOutlined /></Badge> 
        : <RobotOutlined />,
      label: collapsed ? '' : 'AI 配置',
      title: 'AI 配置',
      onClick: () => navigate('/ai-settings'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: collapsed ? '' : '设置',
      title: '设置',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <Sider 
      width={220} 
      collapsible
      collapsed={collapsed}
      trigger={null}
      collapsedWidth={60}
      className="glass-sidebar"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transition: 'all 0.2s ease-in-out',
        borderRadius: 0,
        background: isDarkMode ? 'rgba(18, 18, 28, 0.5)' : 'rgba(255, 255, 255, 0.7)'
      }}
    >
      <div className="logo" style={{ 
        padding: '16px 0', 
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        paddingLeft: collapsed ? 0 : 16,
        paddingRight: collapsed ? 0 : 16,
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'}`
      }}>
        {!collapsed ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ThunderboltOutlined className="logo-icon" />
            <Title level={4} 
              className="neon-text sidebar-logo-title" 
              style={{ 
                color: 'var(--text-color)', 
                margin: 0
              }}
            >
              Copy2AI
            </Title>
          </div>
        ) : (
          <ThunderboltOutlined className="logo-icon" style={{ margin: '0 auto' }} />
        )}
        <Button 
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={toggleCollapsed}
          style={{
            fontSize: '16px',
            width: collapsed ? '100%' : 'auto',
            marginLeft: collapsed ? 0 : 8,
            opacity: (collapsed && isHovering) ? 1 : (collapsed ? 0.6 : 1),
            transition: 'opacity 0.3s ease'
          }}
        />
      </div>
      
      <Menu
        theme={isDarkMode ? "dark" : "light"}
        mode="inline"
        selectedKeys={selectedKeys}
        items={menuItems}
        className="glass-menu"
        style={{
          borderRight: 'none',
          backgroundColor: 'transparent'
        }}
      />
    </Sider>
  );
};

export default Sidebar; 