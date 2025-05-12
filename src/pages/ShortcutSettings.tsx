import React, { useState, useEffect } from 'react';
import { Typography, Divider, Form, Button, Card, Space, message, List } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';

const { Title } = Typography;

interface Shortcut {
  id: string;
  name: string;
  description: string;
  value: string;
}

const ShortcutSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([
    {
      id: 'mainWindow',
      name: '主窗口快捷键',
      description: '显示/隐藏主窗口的快捷键',
      value: 'Alt+C'
    },
    {
      id: 'floatClipboard',
      name: '浮动剪贴板快捷键',
      description: '显示/隐藏浮动剪贴板窗口的快捷键',
      value: 'Alt+F'
    }
  ]);

  useEffect(() => {
    form.setFieldsValue({
      shortcuts: shortcuts.reduce((acc, shortcut) => {
        acc[shortcut.id] = shortcut.value;
        return acc;
      }, {} as Record<string, string>)
    });
  }, [form, shortcuts]);

  const onFinish = async (values: any) => {
    try {
      // 更新快捷键
      for (const shortcut of shortcuts) {
        const oldValue = shortcut.value;
        const newValue = values.shortcuts[shortcut.id];
        
        if (oldValue !== newValue) {
          // 更新本地状态
          setShortcuts(prev => 
            prev.map(s => s.id === shortcut.id ? { ...s, value: newValue } : s)
          );
          
          // 调用后端更新快捷键
          await invoke('update_shortcut', { 
            oldShortcut: oldValue, 
            newShortcut: newValue,
            windowLabel: shortcut.id === 'mainWindow' ? 'main' : 'float_clipboard'
          });
        }
      }
      
      messageApi.success('快捷键设置已保存');
    } catch (error) {
      console.error('保存快捷键设置失败:', error);
      messageApi.error('保存失败，请重试');
    }
  };

  const ShortcutInput: React.FC<{
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
  }> = ({ value = '', onChange, placeholder }) => {
    const [keys, setKeys] = useState<string[]>([]);
    const [recording, setRecording] = useState(false);

    useEffect(() => {
      if (value) {
        setKeys(value.split('+'));
      }
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      
      if (!recording) return;
      
      const key = e.key;
      // 忽略修饰键的单独按下
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        return;
      }
      
      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.metaKey) modifiers.push('Meta');
      
      const newKeys = [...modifiers, key.charAt(0).toUpperCase() + key.slice(1)];
      setKeys(newKeys);
      
      const shortcutValue = newKeys.join('+');
      onChange?.(shortcutValue);
      
      setRecording(false);
    };

    return (
      <div 
        className={`shortcut-input ${recording ? 'recording' : ''}`}
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          padding: '4px 11px',
          cursor: 'pointer',
          background: recording ? '#f0f0f0' : 'white',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
        onClick={() => setRecording(true)}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onBlur={() => setRecording(false)}
      >
        {keys.length > 0 ? (
          <span>{keys.join(' + ')}</span>
        ) : (
          <span style={{ color: '#bfbfbf' }}>{placeholder || '点击设置快捷键'}</span>
        )}
        {recording && <span style={{ color: '#1890ff' }}>正在录制...</span>}
      </div>
    );
  };

  return (
    <div className="shortcut-settings">
      {contextHolder}
      
      <Card bordered={false} className="glass-effect">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          <div style={{ marginBottom: '24px' }}>
            <Title level={5}>快捷键设置（开发中）</Title>
            <Divider style={{ margin: '8px 0 16px 0' }} />
            
            <List
              itemLayout="horizontal"
              dataSource={shortcuts}
              renderItem={shortcut => (
                <List.Item key={shortcut.id}>
                  <List.Item.Meta
                    title={shortcut.name}
                    description={shortcut.description}
                  />
                  <Form.Item
                    name={['shortcuts', shortcut.id]}
                    noStyle
                  >
                    <ShortcutInput placeholder="点击设置快捷键" />
                  </Form.Item>
                </List.Item>
              )}
            />
          </div>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              icon={<SaveOutlined />}
            >
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ShortcutSettings; 