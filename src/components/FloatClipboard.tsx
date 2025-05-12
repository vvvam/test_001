import React, { useState, useEffect } from 'react';
import { Typography, List, Input, Button, Empty, Spin, Card, Space, Tooltip, Tag } from 'antd';
import { SearchOutlined, PushpinOutlined, PushpinFilled, StarOutlined, StarFilled } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { ClipboardItem } from '../types/clipboard';

const { Title, Text } = Typography;
const { Search } = Input;

const FloatClipboard: React.FC = () => {
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  // 获取剪贴板历史记录
  const fetchClipboardHistory = async () => {
    try {
      setLoading(true);
      const data = await invoke<ClipboardItem[]>('get_clipboard_history');
      setClipboardItems(data);
    } catch (error) {
      console.error('获取剪贴板历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 复制内容到剪贴板
  const copyToClipboard = async (content: string) => {
    try {
      await invoke('copy_to_clipboard', { content });
    } catch (error) {
      console.error('复制到剪贴板失败:', error);
    }
  };

  // 切换置顶状态
  const togglePinned = async (item: ClipboardItem) => {
    try {
      const updatedItem = {
        ...item,
        pinned: !item.pinned,
        isPinned: !item.pinned // 保持前端字段兼容性
      };
      await invoke('update_clipboard_item', { item: updatedItem });
      setClipboardItems(clipboardItems.map(i => i.id === item.id ? updatedItem : i));
    } catch (error) {
      console.error('更新剪贴板项失败:', error);
    }
  };

  // 切换收藏状态
  const toggleFavorite = async (item: ClipboardItem) => {
    try {
      const updatedItem = {
        ...item,
        favorite: !item.favorite,
        isFavorite: !item.favorite // 保持前端字段兼容性
      };
      await invoke('update_clipboard_item', { item: updatedItem });
      setClipboardItems(clipboardItems.map(i => i.id === item.id ? updatedItem : i));
    } catch (error) {
      console.error('更新剪贴板项失败:', error);
    }
  };

  // 转换后端数据结构到前端使用的格式
  const processItem = (item: ClipboardItem): ClipboardItem => {
    return {
      ...item,
      isPinned: item.pinned,
      isFavorite: item.favorite
    };
  };

  // 过滤并排序项目
  const filteredItems = React.useMemo(() => {
    let items = clipboardItems.map(processItem);
    
    // 搜索过滤
    if (searchText) {
      items = items.filter(item => 
        item.content.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // 排序：置顶的在前面，然后按时间倒序
    items.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      // 时间比较 (timestamp 是毫秒时间戳)
      return b.timestamp - a.timestamp;
    });
    
    return items;
  }, [clipboardItems, searchText]);

  // 初始化和订阅事件
  useEffect(() => {
    fetchClipboardHistory();
    
    // 每次打开窗口时刷新数据
    const refreshData = () => {
      fetchClipboardHistory();
    };
    
    window.addEventListener('focus', refreshData);
    
    return () => {
      window.removeEventListener('focus', refreshData);
    };
  }, []);

  return (
    <div className="float-clipboard-container" style={{ padding: 16, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4}>浮动剪贴板</Title>
        <Search
          placeholder="搜索剪贴板内容"
          allowClear
          enterButton={<SearchOutlined />}
          onChange={(e) => setSearchText(e.target.value)}
          value={searchText}
          style={{ marginBottom: 16 }}
        />
      </div>
      
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Spin />
          </div>
        ) : filteredItems.length === 0 ? (
          <Empty description="暂无剪贴板记录" />
        ) : (
          <List
            itemLayout="vertical"
            dataSource={filteredItems}
            renderItem={(item) => (
              <Card
                size="small"
                style={{ marginBottom: 8 }}
                hoverable
                onClick={() => copyToClipboard(item.content)}
                actions={[
                  <Tooltip title={item.pinned ? "取消置顶" : "置顶"} key="pin">
                    <Button 
                      type="text" 
                      icon={item.pinned ? <PushpinFilled /> : <PushpinOutlined />} 
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinned(item);
                      }}
                    />
                  </Tooltip>,
                  <Tooltip title={item.favorite ? "取消收藏" : "收藏"} key="favorite">
                    <Button 
                      type="text" 
                      icon={item.favorite ? <StarFilled /> : <StarOutlined />} 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item);
                      }}
                    />
                  </Tooltip>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {item.pinned && <Tag color="blue">置顶</Tag>}
                      {item.favorite && <Tag color="gold">收藏</Tag>}
                      <Text strong>{new Date(item.timestamp).toLocaleString()}</Text>
                    </Space>
                  }
                />
                <div style={{ 
                  maxHeight: '100px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  wordBreak: 'break-all'
                }}>
                  {item.content}
                </div>
              </Card>
            )}
          />
        )}
      </div>
    </div>
  );
};

export default FloatClipboard; 