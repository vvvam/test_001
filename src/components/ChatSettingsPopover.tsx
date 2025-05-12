import React, { useState, useEffect } from 'react';
import { Modal, Button, Tabs, Space, Typography, Tag, message } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import useRoleStore from '../store/roleStore';
import { useAISettingsStore } from '../store/aiSettingsStore';
import { DEFAULT_AI_PROVIDERS } from '../constants/aiProviders';
import { useChatUserPrefsStore } from '../store/chatUserPrefsStore';
import { useChatStore } from '../store/chatStore';
import RoleSelectionGrid from './RoleSelectionGrid';
import ModelSelectionGrid from './ModelSelectionGrid';
import { invoke } from '@tauri-apps/api/core';

const { TabPane } = Tabs;
const { Text } = Typography;

interface ChatSettingsPopoverProps {
  onRoleChange?: (roleId: string) => void;
  onProviderChange?: (providerId: string) => void;
  hideText?: boolean; // 是否隐藏文字，只显示图标
}

/**
 * 对话设置弹窗组件
 * 用于选择对话的默认角色和AI模型
 */
const ChatSettingsPopover: React.FC<ChatSettingsPopoverProps> = ({
  onRoleChange,
  onProviderChange,
  hideText = false
}) => {
  const { roles, loadRoles } = useRoleStore();
  const { defaultRoleId, defaultProviderId, setDefaultRole, setDefaultProvider } = useChatUserPrefsStore();
  const { currentSession } = useChatStore();
  const updateSession = useChatStore(state => state.updateSession);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('role');
  const [selectedRole, setSelectedRole] = useState<string>(defaultRoleId || '');
  const [selectedProvider, setSelectedProvider] = useState<string>(defaultProviderId || '');
  const [loading, setLoading] = useState(false);
  
  // 加载角色
  useEffect(() => {
    loadRoles();
  }, [loadRoles]);
  
  // 初始化选中状态
  useEffect(() => {
    if (!selectedRole && defaultRoleId) {
      setSelectedRole(defaultRoleId);
    }
    
    if (!selectedProvider && defaultProviderId) {
      setSelectedProvider(defaultProviderId);
    }
  }, [defaultRoleId, defaultProviderId, selectedRole, selectedProvider]);
  
  // 处理角色变更
  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
  };
  
  // 处理提供商变更
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
  };
  
  // 应用设置更改
  const applyChanges = async () => {
    setLoading(true);
    
    try {
      // 更新默认角色和提供商
      setDefaultRole(selectedRole);
      setDefaultProvider(selectedProvider);
      
      // 如果提供了回调函数，调用它们
      if (onRoleChange) {
        onRoleChange(selectedRole);
      }
      
      if (onProviderChange) {
        onProviderChange(selectedProvider);
      }
      
      // 如果有当前会话，更新会话的提供商和角色提示词
      if (currentSession) {
        const provider = DEFAULT_AI_PROVIDERS.find(p => p.id === selectedProvider);
        
        // 获取选中角色的提示词
        let rolePrompt: string | undefined;
        try {
          const selectedRoleData = await invoke<{ system_prompt: string }>('get_role', { id: selectedRole });
          rolePrompt = selectedRoleData?.system_prompt;
        } catch (error) {
          console.error('获取角色信息失败:', error);
          message.warning('获取角色提示词失败，将保留原有提示词');
        }
        
        // 更新会话
        updateSession(currentSession.id, {
          aiProvider: provider,
          ...(rolePrompt && { rolePrompt }) // 仅当获取到提示词时才更新
        });
        
        message.success('设置已更新');
      }
      
      setModalVisible(false);
    } catch (error) {
      console.error('应用设置更改时出错:', error);
      message.error('更新设置失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取选中角色名称
  const getSelectedRoleName = () => {
    const role = roles.find(r => r.id === selectedRole);
    return role ? role.name : '未选择';
  };
  
  // 获取选中提供商名称
  const getSelectedProviderName = () => {
    const provider = DEFAULT_AI_PROVIDERS.find(p => p.id === selectedProvider);
    return provider ? provider.name : '未选择';
  };
  
  return (
    <>
      <Button 
        icon={<SettingOutlined />} 
        type="text"
        onClick={() => setModalVisible(true)}
      >
        {!hideText && '设置'}
      </Button>
      
      <Modal
        title="对话设置"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="apply"
            type="primary"
            loading={loading}
            onClick={applyChanges}
          >
            应用
          </Button>
        ]}
        width={800}
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          style={{ marginBottom: 24 }}
        >
          <TabPane tab="角色设置" key="role">
            <RoleSelectionGrid 
              onSelectRole={handleRoleChange}
              selectedRoleId={selectedRole}
            />
          </TabPane>
          <TabPane tab="模型设置" key="model">
            <ModelSelectionGrid
              onSelectProvider={handleProviderChange}
              selectedProviderId={selectedProvider}
            />
          </TabPane>
        </Tabs>
        
        <div style={{ marginTop: 16 }}>
          <Text strong>当前选择：</Text>
          <Space style={{ marginLeft: 8 }}>
            {selectedRole && (
              <Tag color="blue">角色: {getSelectedRoleName()}</Tag>
            )}
            {selectedProvider && (
              <Tag color="green">模型: {getSelectedProviderName()}</Tag>
            )}
          </Space>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">设置更改将在下一次发送消息时生效</Text>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ChatSettingsPopover; 