import React, { useState } from 'react';
import { 
  Modal, 
  Typography, 
  Spin, 
  Alert, 
  Button, 
  Space, 
  Card
} from 'antd';
import { 
  TranslationOutlined, 
  CopyOutlined, 
  CloseCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';

const { Text, Paragraph } = Typography;

interface TranslationItem {
  src: string;
  dst: string;
}

interface TranslationResult {
  from: string;
  to: string;
  trans_result: TranslationItem[];
  error_code?: string;
  error_msg?: string;
}

interface TranslationResultProps {
  visible: boolean;
  onClose: () => void;
  text: string;
}

const TranslationResult: React.FC<TranslationResultProps> = ({ visible, onClose, text }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // 翻译文本
  const translateText = async () => {
    if (!text) return;
    
    // 检查字符数限制
    const MAX_CHARS = 2000;
    const charCount = text.length;
    
    if (charCount > MAX_CHARS) {
      setError(`文本超过${MAX_CHARS}字符限制，当前为${charCount}字符。请缩短文本后重试。`);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      
      // 调用后端翻译API
      const result = await invoke<TranslationResult>('translate_text', { text });
      setResult(result);
    } catch (error) {
      console.error('翻译失败:', error);
      setError(`翻译失败: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 复制翻译结果
  const copyTranslation = async () => {
    if (!result || !result.trans_result || result.trans_result.length === 0) return;
    
    try {
      const translationText = result.trans_result.map(item => item.dst).join('\n');
      await writeText(translationText);
      setCopied(true);
      
      // 重置复制状态
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('复制翻译结果失败:', error);
      setError(`复制翻译结果失败: ${String(error)}`);
    }
  };
  
  // 当对话框打开时自动翻译
  React.useEffect(() => {
    if (visible && text) {
      translateText();
    }
  }, [visible, text]);
  
  return (
    <Modal
      title={
        <Space>
          <TranslationOutlined />
          <span>翻译结果</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button 
          key="copy" 
          type="primary" 
          icon={<CopyOutlined />} 
          onClick={copyTranslation}
          disabled={!result || !result.trans_result || result.trans_result.length === 0}
        >
          {copied ? '已复制' : '复制结果'}
        </Button>
      ]}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div style={{ marginTop: '16px' }}>正在翻译...</div>
        </div>
      ) : error ? (
        <Alert
          message="翻译错误"
          description={error}
          type="error"
          showIcon
          icon={<CloseCircleOutlined />}
        />
      ) : result ? (
        <div>
          <Card title="原文" style={{ marginBottom: '16px' }}>
            <Paragraph>{text}</Paragraph>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              字符数: {text.length}/2000
            </Text>
          </Card>
          
          <Card 
            title={`译文 (${getLanguageName(result.from)} → ${getLanguageName(result.to)})`}
            style={{ marginBottom: '16px' }}
          >
            {result.trans_result.map((item, index) => (
              <Paragraph key={index}>{item.dst}</Paragraph>
            ))}
          </Card>
        </div>
      ) : (
        <Alert
          message="等待翻译"
          description="正在准备翻译，请稍候..."
          type="info"
          showIcon
        />
      )}
    </Modal>
  );
};

// 获取语言名称
function getLanguageName(code: string): string {
  const languageMap: Record<string, string> = {
    'auto': '自动检测',
    'zh': '中文',
    'en': '英语',
    'yue': '粤语',
    'wyw': '文言文',
    'jp': '日语',
    'kor': '韩语',
    'fra': '法语',
    'spa': '西班牙语',
    'th': '泰语',
    'ara': '阿拉伯语',
    'ru': '俄语',
    'pt': '葡萄牙语',
    'de': '德语',
    'it': '意大利语',
    'el': '希腊语',
    'nl': '荷兰语',
    'pl': '波兰语',
    'bul': '保加利亚语',
    'est': '爱沙尼亚语',
    'dan': '丹麦语',
    'fin': '芬兰语',
    'cs': '捷克语',
    'rom': '罗马尼亚语',
    'slo': '斯洛文尼亚语',
    'swe': '瑞典语',
    'hu': '匈牙利语',
    'cht': '繁体中文',
    'vie': '越南语',
  };
  
  return languageMap[code] || code;
}

export default TranslationResult; 