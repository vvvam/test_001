import React, { useState } from 'react';
import { Typography, Divider, Form, Button, Card, Space, message, Switch, Radio, Slider, InputNumber, Row, Col } from 'antd';
import { SaveOutlined, AppstoreOutlined } from '@ant-design/icons';
import { emit } from '@tauri-apps/api/event';

const { Title, Text } = Typography;

const WindowSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [floatStyle, setFloatStyle] = useState<string>('normal');

  const onFinish = (values: any) => {
    console.log('保存窗口设置:', values);
    messageApi.success('窗口设置已保存');
  };

  const openFloatWindow = async () => {
    try {
      // 通过事件触发创建浮动窗口
      await emit('create-float-clipboard-window', {});
      messageApi.success('浮动剪贴板窗口已打开');
    } catch (error) {
      console.error('打开浮动窗口失败:', error);
      messageApi.error('打开浮动窗口失败');
    }
  };

  const handleFloatStyleChange = (e: any) => {
    setFloatStyle(e.target.value);
  };

  // 格式化百分比
  const formatPercent = (value: number | undefined) => (value ? `${value}%` : '');
  
  // 解析百分比
  const parsePercent = (value: string | undefined) => {
    const parsedValue = parseInt(value ? value.replace('%', '') : '0', 10);
    return isNaN(parsedValue) ? 50 : Math.min(Math.max(parsedValue, 50), 100);
  };

  return (
    <div className="window-settings">
      {contextHolder}
      
      <Card bordered={false} className="glass-effect">
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            mainWindowTransparency: 100,
            floatWindowStyle: 'normal',
            floatWindowAlwaysOnTop: true,
            floatWindowTransparency: 90,
            floatWindowSize: 'medium'
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <Title level={5}>主窗口设置</Title>
            <Divider style={{ margin: '8px 0 16px 0' }} />
            
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            <Title level={5}>浮动剪贴板窗口设置</Title>
            <Divider style={{ margin: '8px 0 16px 0' }} />
            

            
            <Form.Item
              name="floatWindowAlwaysOnTop"
              label="总是置顶"
              valuePropName="checked"
              tooltip="浮动窗口是否始终显示在其他窗口之上"
            >
              <Switch />
            </Form.Item>
            
            <Form.Item
              name="floatWindowTransparency"
              label="窗口透明度"
            >
              <Row>
                <Col span={18}>
                  <Slider
                    min={50}
                    max={100}
                    onChange={(value) => form.setFieldsValue({ floatWindowTransparency: value })}
                  />
                </Col>
                <Col span={4} offset={2}>
                  <InputNumber
                    min={50}
                    max={100}
                    style={{ width: '100%' }}
                    formatter={formatPercent}
                    parser={parsePercent}
                  />
                </Col>
              </Row>
            </Form.Item>

            
            <Button 
              type="primary" 
              icon={<AppstoreOutlined />} 
              onClick={openFloatWindow}
              style={{ marginTop: '16px' }}
            >
              打开浮动剪贴板窗口
            </Button>
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

export default WindowSettings; 