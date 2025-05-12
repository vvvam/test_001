import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Divider, 
  Form, 
  Switch, 
  Select, 
  Input,
  InputNumber, 
  Button, 
  Card, 
  Space,
  Radio,
  Tooltip,
  message,
  Tabs,
  Alert
} from 'antd';
import { SaveOutlined, QuestionCircleOutlined, ExclamationCircleOutlined, TranslationOutlined, TagsOutlined, KeyOutlined, WindowsOutlined, SettingOutlined } from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import ShortcutSettings from './ShortcutSettings';
import WindowSettings from './WindowSettings';
import CategorySettings from './CategorySettings';
import TranslationSettings from './TranslationSettings';
import { invoke } from '@tauri-apps/api/core';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState(theme);
  const [activeTab, setActiveTab] = useState('1');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedValues, setLastSavedValues] = useState<any>(null);

  // 从后端获取设置
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setInitialLoading(true);
        setError(null);
        
        console.log("开始获取设置...");
        
        // 获取开机启动状态
        const autoStartEnabled = await invoke<boolean>('plugin:autostart|is_enabled');
        console.log("获取到开机启动状态:", autoStartEnabled);
        
        // 获取最大历史记录数量
        const maxItems = await invoke<number>('get_max_history_items');
        console.log("获取到最大历史记录数量:", maxItems);
        
        // 设置表单初始值
        const initialValues = {
          theme,
          language: 'zh_CN',
          startWithSystem: autoStartEnabled,
          maxHistoryItems: maxItems || 500,
          autoCategorize: true
        };
        
        console.log("设置表单初始值:", initialValues);
        form.setFieldsValue(initialValues);
        setLastSavedValues(initialValues);
        
      } catch (error) {
        console.error('获取设置失败:', error);
        setError(`获取设置失败: ${String(error)}`);
        message.error('获取设置失败: ' + String(error));
        
        // 设置默认值
        const defaultValues = {
          theme,
          language: 'zh_CN',
          startWithSystem: false,
          maxHistoryItems: 500,
          autoCategorize: true
        };
        
        form.setFieldsValue(defaultValues);
        setLastSavedValues(defaultValues);
      } finally {
        setInitialLoading(false);
      }
    };
    
    fetchSettings();
    setSelectedTheme(theme);
  }, [form, theme]);

  const onFinish = async (values: any) => {
    console.log('保存设置:', values);
    
    // 验证表单数据是否完整
    if (!values) {
      console.error('表单数据为空');
      messageApi.error('保存设置失败: 表单数据为空');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // 主题已在选择时立即应用，这里只处理其他设置
      
      // 保存开机启动设置
      try {
        if (values.startWithSystem !== undefined) {
          if (values.startWithSystem) {
            console.log("启用开机自启动...");
            await invoke('plugin:autostart|enable');
            console.log("开机自启动已启用");
          } else {
            console.log("禁用开机自启动...");
            await invoke('plugin:autostart|disable');
            console.log("开机自启动已禁用");
          }
        }
      } catch (autoStartError) {
        console.error('设置开机自启动失败:', autoStartError);
        // 继续执行其他设置，不中断流程
      }
      
      // 保存最大历史记录数量
      if (values.maxHistoryItems && values.maxHistoryItems > 0) {
        console.log("设置最大历史记录数量:", values.maxHistoryItems);
        try {
          await invoke('set_max_history_items', { maxItems: values.maxHistoryItems });
          console.log("最大历史记录数量已设置");
        } catch (historyError) {
          console.error('设置最大历史记录数量失败:', historyError);
          // 尝试重试一次
          try {
            console.log("重试设置最大历史记录数量...");
            await invoke('set_max_history_items', { maxItems: values.maxHistoryItems });
            console.log("重试成功，最大历史记录数量已设置");
          } catch (retryError) {
            throw new Error(`设置最大历史记录数量失败: ${retryError}`);
          }
        }
      } else {
        console.warn("无效的最大历史记录数量:", values.maxHistoryItems);
      }
      
      // 更新保存的值
      setLastSavedValues(values);
      
      // 其他设置可以添加到这里...
      
      messageApi.success('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      
      // 解析错误消息
      let errorMsg = String(error);
      let suggestionMsg = '';
      
      // 针对特定错误提供解决方案
      if (errorMsg.includes('系统找不到指定的文件') || errorMsg.includes('os error 2')) {
        suggestionMsg = '可能是应用没有写入权限。请尝试以管理员身份运行应用，或检查应用数据目录的访问权限。';
      } else if (errorMsg.includes('权限被拒绝') || errorMsg.includes('permission denied')) {
        suggestionMsg = '应用没有足够的权限写入配置文件。请尝试以管理员身份运行应用。';
      } else if (errorMsg.includes('路径不存在') || errorMsg.includes('no such file or directory')) {
        suggestionMsg = '应用数据目录可能不存在或无法访问。请确保应用安装正确。';
      }
      
      // 设置错误状态并显示错误消息
      const fullErrorMsg = suggestionMsg ? `${errorMsg}。${suggestionMsg}` : errorMsg;
      setError(`保存设置失败: ${fullErrorMsg}`);
      messageApi.error({
        content: `保存设置失败: ${fullErrorMsg}`,
        duration: 8, // 显示更长时间以便用户阅读
      });
    } finally {
      setLoading(false);
    }
  };

  // 处理主题选择 - 立即应用
  const handleThemeChange = (e: any) => {
    const value = e.target.value;
    setSelectedTheme(value);
    form.setFieldsValue({ theme: value });
    
    // 立即应用主题变更
    setTheme(value);
    messageApi.success(`已切换到${value === 'light' ? '亮色' : value === 'dark' ? '暗色' : '跟随系统'}主题`);
  };

  const renderGeneralSettings = () => (
    <Card bordered={false} className="glass-effect" style={{ position: 'relative', zIndex: 1 }}>
      {initialLoading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div>加载设置中...</div>
        </div>
      ) : (
        <>
          {error && (
            <Alert
              message="错误"
              description={error}
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
              style={{ marginBottom: 16 }}
              closable
            />
          )}
          
          {lastSavedValues && (
            <Alert
              message="当前设置"
              description={
                <div>
                  <div>开机启动: {lastSavedValues.startWithSystem ? '已启用' : '已禁用'}</div>
                  <div>最大历史记录数量: {lastSavedValues.maxHistoryItems}</div>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            disabled={initialLoading}
          >
            <div style={{ marginBottom: '24px' }}>
              <Title level={5}>基本设置</Title>
              <Divider style={{ margin: '8px 0 16px 0' }} />
              
              <Form.Item 
                name="theme" 
                label={
                  <Space>
                    <span>主题</span>
                    <Tooltip title="选择应用的显示主题，支持亮色、暗色和系统模式，点击立即生效">
                      <QuestionCircleOutlined />
                    </Tooltip>
                  </Space>
                }
              >
                <div className="theme-selector">
                  <Radio.Group value={selectedTheme} onChange={handleThemeChange}>
                    <Radio.Button 
                      value="light" 
                      className={`theme-option ${selectedTheme === 'light' ? 'active pulse-effect' : ''}`}
                      style={{
                        background: selectedTheme === 'light' ? 'rgba(240, 245, 255, 0.9)' : undefined,
                        color: selectedTheme === 'light' ? '#1890ff' : undefined,
                        fontWeight: selectedTheme === 'light' ? 'bold' : 'normal',
                        boxShadow: selectedTheme === 'light' ? '0 0 8px rgba(24, 144, 255, 0.5)' : undefined,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      亮色
                    </Radio.Button>
                    <Radio.Button 
                      value="dark" 
                      className={`theme-option ${selectedTheme === 'dark' ? 'active pulse-effect' : ''}`}
                      style={{
                        background: selectedTheme === 'dark' ? 'rgba(18, 22, 33, 0.9)' : undefined,
                        color: selectedTheme === 'dark' ? '#40a9ff' : undefined,
                        fontWeight: selectedTheme === 'dark' ? 'bold' : 'normal',
                        boxShadow: selectedTheme === 'dark' ? '0 0 8px rgba(24, 144, 255, 0.5)' : undefined,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      暗色
                    </Radio.Button>
                    <Radio.Button 
                      value="system" 
                      className={`theme-option ${selectedTheme === 'system' ? 'active pulse-effect' : ''}`}
                      style={{
                        background: selectedTheme === 'system' ? 'rgba(var(--bg-color-rgb), 0.3)' : undefined,
                        color: selectedTheme === 'system' ? 'var(--primary-color)' : undefined,
                        fontWeight: selectedTheme === 'system' ? 'bold' : 'normal',
                        boxShadow: selectedTheme === 'system' ? '0 0 8px rgba(24, 144, 255, 0.5)' : undefined,
                        transition: 'all 0.3s ease'
                      }}
                    >
                      跟随系统
                    </Radio.Button>
                  </Radio.Group>
                </div>
              </Form.Item>
              
              <Form.Item name="language" label="语言">
                <Select className="glass-select">
                  <Option value="zh_CN">中文 (简体)</Option>
                  <Option value="en_US">English</Option>
                  <Option value="ja_JP">日本語</Option>
                </Select>
              </Form.Item>

              
              <Form.Item 
                name="startWithSystem" 
                label="开机启动" 
                valuePropName="checked"
                tooltip="设置应用是否随系统启动"
              >
                <Switch />
              </Form.Item>
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <Title level={5}>剪贴板设置</Title>
              <Divider style={{ margin: '8px 0 16px 0' }} />
              
              <Form.Item 
                name="maxHistoryItems" 
                label="最大历史记录数量" 
                tooltip="设置最多保存的剪贴板历史记录数量"
              >
                <InputNumber min={10} max={4000} style={{ width: '100%' }} />
              </Form.Item>
              
              <Form.Item 
                name="autoCategorize" 
                label="自动分类" 
                valuePropName="checked"
                tooltip="根据内容自动分类剪贴板项"
                initialValue={true}
              >
                <Switch />
              </Form.Item>

            </div>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />}
                loading={loading}
              >
                保存设置
              </Button>
            </Form.Item>
          </Form>
        </>
      )}
    </Card>
  );

  return (
    <div className="settings-container">
      {contextHolder}
      <div className="settings-header">
        <Title level={3}>设置</Title>
        <Text type="secondary">自定义应用行为和外观</Text>
      </div>
      
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        tabPosition="top"
        style={{ padding: '16px' }}
        items={[
          {
            key: '1',
            label: (
              <span>
                <SettingOutlined /> 通用设置
              </span>
            ),
            children: renderGeneralSettings()
          },
          {
            key: '2',
            label: (
              <span>
                <KeyOutlined /> 快捷键
              </span>
            ),
            children: <ShortcutSettings />
          },
          {
            key: '3',
            label: (
              <span>
                <WindowsOutlined /> 窗口设置
              </span>
            ),
            children: <WindowSettings />
          },
          {
            key: '4',
            label: (
              <span>
                <TagsOutlined /> 分类设置
              </span>
            ),
            children: <CategorySettings />
          },
          {
            key: '5',
            label: (
              <span>
                <TranslationOutlined /> 翻译设置
              </span>
            ),
            children: <TranslationSettings />
          }
        ]}
      />
    </div>
  );
};

export default Settings; 