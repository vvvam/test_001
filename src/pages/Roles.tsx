import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Typography, 
  List, 
  Modal, 
  Form, 
  Input, 
  Divider,
  Space,
  Avatar,
  Tooltip,
  Select,
  Popconfirm
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UserOutlined,
  ExclamationCircleOutlined,
  UndoOutlined
} from '@ant-design/icons';
import useRoleStore from '../store/roleStore';
import { Role, ROLE_ICONS } from '../models/role';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { confirm } = Modal;

const Roles: React.FC = () => {
  const { roles, loading, loadRoles, addRole, updateRole, deleteRole, resetRole } = useRoleStore();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [form] = Form.useForm();
  const [customEmoji, setCustomEmoji] = useState<string[]>([]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    // 收集所有图标作为自定义选项
    const allIcons = roles
      .map(role => role.icon)
      .filter(icon => icon && !ROLE_ICONS.includes(icon));
    
    setCustomEmoji([...new Set([...ROLE_ICONS, ...allIcons])]);
  }, [roles]);

  const showModal = (role?: Role) => {
    if (role) {
      setCurrentRole(role);
      form.setFieldsValue({
        ...role,
        // 后端使用 system_prompt，前端表单使用 systemPrompt
        systemPrompt: role.system_prompt
      });
    } else {
      setCurrentRole(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleOk = () => {
    form.validateFields().then(async values => {
      // 将表单字段名从驼峰转换为下划线
      const formattedValues = {
        ...values,
        system_prompt: values.systemPrompt
      };
      
      let success = false;
      
      if (currentRole) {
        // 更新现有角色
        success = await updateRole({
          ...currentRole,
          name: formattedValues.name,
          description: formattedValues.description,
          system_prompt: formattedValues.system_prompt,
          icon: formattedValues.icon || currentRole.icon
        });
      } else {
        // 添加新角色
        success = await addRole({
          name: formattedValues.name,
          description: formattedValues.description,
          system_prompt: formattedValues.system_prompt,
          icon: formattedValues.icon || '💻',
          avatar: null,
          is_custom: true
        });
      }
      
      if (success) {
        setIsModalVisible(false);
      }
    });
  };

  const handleDelete = (id: string) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个角色吗？此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        deleteRole(id);
      }
    });
  };

  const handleReset = (id: string) => {
    resetRole(id);
  };

  return (
    <div className="roles-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Title level={4}>AI 角色管理</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => showModal()}
        >
          添加角色
        </Button>
      </div>
      
      <Divider style={{ margin: '0 0 16px 0' }} />
      
      <List
        loading={loading}
        grid={{ gutter: 16, column: 2 }}
        dataSource={roles}
        renderItem={role => (
          <List.Item>
            <Card 
              hoverable 
              style={{ borderRadius: '8px' }}
              actions={[
                <Tooltip title="编辑">
                  <Button 
                    type="text" 
                    icon={<EditOutlined />} 
                    onClick={() => showModal(role)} 
                  />
                </Tooltip>,
                ...(role.is_custom ? [
                  <Tooltip title="删除">
                    <Button 
                      type="text" 
                      danger
                      icon={<DeleteOutlined />} 
                      onClick={() => handleDelete(role.id)} 
                    />
                  </Tooltip>
                ] : [
                  <Tooltip title="重置为默认">
                    <Popconfirm
                      title="重置确认"
                      description="确定要将此角色重置为默认设置吗？"
                      onConfirm={() => handleReset(role.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button 
                        type="text" 
                        icon={<UndoOutlined />} 
                      />
                    </Popconfirm>
                  </Tooltip>
                ])
              ]}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Avatar size={40}>{role.icon || <UserOutlined />}</Avatar>
                <div style={{ marginLeft: '12px' }}>
                  <Text strong style={{ fontSize: '16px' }}>{role.name}</Text>
                  <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                    {role.description}
                  </Paragraph>
                </div>
              </div>
            </Card>
          </List.Item>
        )}
      />
      
      <Modal
        title={currentRole ? "编辑角色" : "添加角色"}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        okText={currentRole ? "保存" : "添加"}
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="输入角色名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="角色描述"
            rules={[{ required: true, message: '请输入角色描述' }]}
          >
            <Input placeholder="简短描述这个角色的功能" />
          </Form.Item>
          <Form.Item
            name="systemPrompt"
            label="系统提示词"
            rules={[{ required: true, message: '请输入系统提示词' }]}
          >
            <TextArea 
              placeholder="输入系统提示词，用于指导AI的行为和回复风格" 
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </Form.Item>
          <Form.Item
            name="icon"
            label="角色图标"
            tooltip="可从列表选择，也可以直接输入Emoji表情"
          >
            <Select 
              placeholder="选择或输入一个图标" 
              allowClear
              showSearch
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ padding: '0 8px 4px' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      可直接粘贴或输入Emoji表情符号
                    </Text>
                  </div>
                </>
              )}
            >
              {customEmoji.map((icon, index) => (
                <Select.Option key={index} value={icon}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', marginRight: '8px' }}>{icon}</span>
                    <span>{ROLE_ICONS.includes(icon) ? `图标 ${ROLE_ICONS.indexOf(icon) + 1}` : '自定义'}</span>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Roles; 