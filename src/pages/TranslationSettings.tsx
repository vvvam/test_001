import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Divider, 
  Form, 
  Input,
  Button, 
  Card, 
  Select,
  message,
  Spin,
  Alert,
  Space,
  Tooltip,
} from 'antd';
import { 
  SaveOutlined, 
  TranslationOutlined, 
  QuestionCircleOutlined, 
  LoadingOutlined 
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';

const { Title, Text } = Typography;
const { Option } = Select;

// 语言信息接口
interface LanguageInfo {
  code: string;
  name: string;
}

// 翻译设置接口
interface TranslationSettings {
  appid: string;
  key: string;
  translation_from: string;
  translation_to: string;
}

const TranslationSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [languageOptions, setLanguageOptions] = useState<LanguageInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 从后端获取翻译设置
  useEffect(() => {
    const fetchTranslationSettings = async () => {
      try {
        setInitialLoading(true);
        setError(null);
        
        console.log("开始获取翻译设置...");
        
        // 获取语言列表
        const languages = await invoke<LanguageInfo[]>('get_supported_languages');
        console.log("获取到支持的语言列表:", languages);
        setLanguageOptions(languages);
        
        // 获取当前设置
        const settings = await invoke<TranslationSettings>('get_translation_settings');
        console.log("获取到翻译设置:", settings);
        
        // 设置表单初始值
        form.setFieldsValue({
          appid: settings.appid,
          key: settings.key,
          source_language: settings.translation_from,
          target_language: settings.translation_to,
        });
        
      } catch (error) {
        console.error('获取翻译设置失败:', error);
        setError(`获取翻译设置失败: ${String(error)}`);
        messageApi.error('获取翻译设置失败: ' + String(error));
        
        // 设置默认值
        form.setFieldsValue({
          appid: '',
          key: '',
          source_language: 'auto',
          target_language: 'zh',
        });
      } finally {
        setInitialLoading(false);
      }
    };
    
    fetchTranslationSettings();
  }, [form]);

  // 保存设置
  const onFinish = async (values: any) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('保存翻译设置:', values);
      
      // 转换为后端所需格式
      const settings: TranslationSettings = {
        appid: values.appid,
        key: values.key,
        translation_from: values.source_language,
        translation_to: values.target_language,
      };
      
      // 调用后端保存设置
      await invoke('update_translation_settings', { settings });
      
      messageApi.success('翻译设置已保存');
    } catch (error) {
      console.error('保存翻译设置失败:', error);
      setError(`保存翻译设置失败: ${String(error)}`);
      messageApi.error('保存翻译设置失败: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  // 测试API连接
  const testApiConnection = async () => {
    try {
      setTestingConnection(true);
      setError(null);
      
      const values = form.getFieldsValue();
      
      // 转换为后端所需格式
      const settings: TranslationSettings = {
        appid: values.appid,
        key: values.key,
        translation_from: values.source_language,
        translation_to: values.target_language,
      };
      
      // 调用后端测试API
      const testResult = await invoke<boolean>('test_translation_api', { settings });
      
      if (testResult) {
        messageApi.success('API连接测试成功');
      } else {
        messageApi.error('API连接测试失败');
      }
    } catch (error) {
      console.error('API连接测试失败:', error);
      setError(`API连接测试失败: ${String(error)}`);
      messageApi.error('API连接测试失败: ' + String(error));
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <Card bordered={false} className="glass-effect" style={{ position: 'relative', zIndex: 1 }}>
      {contextHolder}
      
      {initialLoading ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div style={{ marginTop: '8px' }}>加载翻译设置中...</div>
        </div>
      ) : (
        <>
          {error && (
            <Alert
              message="错误"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              closable
            />
          )}
          
          <div style={{ marginBottom: '16px' }}>
            <Title level={4}>
              <TranslationOutlined /> 翻译设置
            </Title>
            <Text type="secondary">
              配置百度翻译API凭证和默认翻译方向
            </Text>
            <Divider style={{ margin: '12px 0' }} />
          </div>
          
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            disabled={initialLoading}
          >
            <Form.Item
              name="appid"
              label="AppID"
              rules={[{ required: true, message: '请输入百度翻译API的AppID' }]}
              tooltip="百度翻译平台申请的应用ID，访问百度翻译开放平台获取"
            >
              <Input placeholder="请输入百度翻译API的AppID" />
            </Form.Item>
            
            <Form.Item
              name="key"
              label="密钥"
              rules={[{ required: true, message: '请输入百度翻译API的密钥' }]}
              tooltip="百度翻译平台申请的应用密钥"
            >
              <Input.Password placeholder="请输入百度翻译API的密钥" />
            </Form.Item>
            
            <Form.Item
              name="source_language"
              label="源语言"
              tooltip="默认的源语言设置，可选自动检测"
            >
              <Select placeholder="请选择源语言">
                {languageOptions.map(lang => (
                  <Option key={lang.code} value={lang.code}>{lang.name}</Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item
              name="target_language"
              label="目标语言"
              tooltip="默认的目标语言设置"
              rules={[{ required: true, message: '请选择目标语言' }]}
            >
              <Select placeholder="请选择目标语言">
                {languageOptions.filter(lang => lang.code !== 'auto').map(lang => (
                  <Option key={lang.code} value={lang.code}>{lang.name}</Option>
                ))}
              </Select>
            </Form.Item>
            
            <Divider style={{ margin: '8px 0 16px 0' }} />
            
            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  icon={<SaveOutlined />} 
                  loading={loading}
                >
                  保存设置
                </Button>
                
                <Button 
                  onClick={testApiConnection} 
                  loading={testingConnection}
                >
                  测试API连接
                </Button>
                
                <Tooltip title="请先保存设置后再测试API连接">
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            </Form.Item>
            
            <Alert
              message="使用说明"
              description={(
                <>
                  <p>①翻译功能需要配置百度翻译API，请访问<a href="https://fanyi-api.baidu.com/manage/developer" target="_blank" rel="noopener noreferrer">百度翻译开放平台</a>开通通用文本翻译，申请免费的API密钥。</p>
                  <p>②配置完成后，您可以在剪贴板历史中右键点击任意条目，选择"翻译"选项。</p>
</>
              )}
              type="info"
              showIcon
            />
          </Form>
        </>
      )}
    </Card>
  );
};

export default TranslationSettings; 