import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  List, 
  Input, 
  Button, 
  Card, 
  Space, 
  Typography, 
  Empty, 
  Tooltip, 
  message, 
  Divider,
  Tag,
  Dropdown
} from 'antd';
import { 
  SearchOutlined, 
  StarOutlined, 
  StarFilled, 
  PushpinOutlined, 
  PushpinFilled, 
  CopyOutlined, 
  DeleteOutlined,
  CloseOutlined,
  SettingOutlined,
  TranslationOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { useTheme } from '../context/ThemeContext';
import TranslationResult from '../components/TranslationResult';
import type { MenuProps } from 'antd';
import './FloatClipboard.css';

const { Text } = Typography;
const { Search } = Input;

// 剪贴板条目类型
interface ClipboardItem {
  id: string;
  content: string;
  timestamp: number;
  favorite: boolean;
  pinned: boolean;
  category?: string;
  translation?: string;
  summary?: string;
}

// 过滤选项类型
interface FilterOptions {
  searchText: string;
  showFavoritesOnly: boolean;
  showPinnedOnly: boolean;
}

const FloatClipboard: React.FC = () => {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const { theme } = useTheme();
  
  // 过滤选项
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    searchText: '',
    showFavoritesOnly: false,
    showPinnedOnly: false
  });
  
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [translatingItem, setTranslatingItem] = useState<ClipboardItem | null>(null);
  
  // 获取剪贴板历史
  const fetchClipboardHistory = useCallback(async () => {
    try {
      setLoading(true);
      const history = await invoke<ClipboardItem[]>('get_clipboard_history');
      setItems(history || []);
    } catch (error) {
      console.error('获取剪贴板历史失败:', error);
      messageApi.error('获取剪贴板历史失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);
  
  // 初始加载
  useEffect(() => {
    fetchClipboardHistory();
    
    // 设置轮询刷新 (每30秒)
    const intervalId = setInterval(fetchClipboardHistory, 30000);
    return () => clearInterval(intervalId);
  }, [fetchClipboardHistory]);
  
  // 复制内容到剪贴板
  const handleCopy = async (content: string) => {
    try {
      await invoke('copy_to_clipboard', { content });
      messageApi.success('已复制到剪贴板');
    } catch (error) {
      console.error('复制失败:', error);
      messageApi.error('复制失败');
    }
  };
  
  // 删除条目
  const handleDelete = async (id: string) => {
    try {
      await invoke('remove_clipboard_item', { id });
      messageApi.success('已删除');
      // 更新列表
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('删除失败:', error);
      messageApi.error('删除失败');
    }
  };
  
  // 切换收藏状态
  const toggleFavorite = async (item: ClipboardItem) => {
    try {
      const updatedItem = { ...item, favorite: !item.favorite };
      await invoke('update_clipboard_item', { item: updatedItem });
      
      // 更新列表
      setItems(prev => prev.map(i => 
        i.id === item.id ? updatedItem : i
      ));
      
      messageApi.success(updatedItem.favorite ? '已添加到收藏' : '已取消收藏');
    } catch (error) {
      console.error('更新收藏状态失败:', error);
      messageApi.error('操作失败');
    }
  };
  
  // 切换置顶状态
  const togglePin = async (item: ClipboardItem) => {
    try {
      const updatedItem = { ...item, pinned: !item.pinned };
      await invoke('update_clipboard_item', { item: updatedItem });
      
      // 更新列表
      setItems(prev => prev.map(i => 
        i.id === item.id ? updatedItem : i
      ));
      
      messageApi.success(updatedItem.pinned ? '已置顶' : '已取消置顶');
    } catch (error) {
      console.error('更新置顶状态失败:', error);
      messageApi.error('操作失败');
    }
  };
  
  // 处理搜索
  const handleSearch = (value: string) => {
    setFilterOptions(prev => ({ ...prev, searchText: value }));
  };
  
  // 切换仅显示收藏
  const toggleShowFavoritesOnly = () => {
    setFilterOptions(prev => ({ ...prev, showFavoritesOnly: !prev.showFavoritesOnly }));
  };
  
  // 切换仅显示置顶
  const toggleShowPinnedOnly = () => {
    setFilterOptions(prev => ({ ...prev, showPinnedOnly: !prev.showPinnedOnly }));
  };
  
  // 关闭窗口
  const closeWindow = async () => {
    try {
      // 发送事件来隐藏窗口
      const { emit } = await import('@tauri-apps/api/event');
      await emit('hide-float-clipboard-window', {});
      messageApi.info('窗口已隐藏');
    } catch (error) {
      console.error('隐藏窗口失败:', error);
      messageApi.error('隐藏窗口失败');
    }
  };
  
  // 打开设置
  const openSettings = async () => {
    try {
      // 可以实现打开设置页面的逻辑
      messageApi.info('打开设置');
    } catch (error) {
      console.error('打开设置失败:', error);
    }
  };
  
  // 过滤后的条目
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        // 搜索文本过滤
        if (filterOptions.searchText && !item.content.toLowerCase().includes(filterOptions.searchText.toLowerCase())) {
          return false;
        }
        
        // 仅显示收藏
        if (filterOptions.showFavoritesOnly && !item.favorite) {
          return false;
        }
        
        // 仅显示置顶
        if (filterOptions.showPinnedOnly && !item.pinned) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // 首先按置顶状态排序
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        
        // 然后按时间戳排序（新的在前）
        return b.timestamp - a.timestamp;
      });
  }, [items, filterOptions]);
  
  // 格式化时间戳为可读时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // 格式化内容
  const formatContent = (content: string) => {
    // 如果内容太长则截断
    if (content.length > 100) {
      return content.substring(0, 100) + '...';
    }
    return content;
  };
  
  // 处理翻译请求
  const handleTranslate = (item: ClipboardItem) => {
    setTranslatingItem(item);
    setShowTranslationModal(true);
  };
  
  // 获取下拉菜单项
  const getDropdownMenuItems = (item: ClipboardItem): MenuProps['items'] => {
    return [
      {
        key: 'translate',
        label: '翻译',
        icon: <TranslationOutlined />,
        onClick: (e) => {
          e.domEvent.stopPropagation();
          handleTranslate(item);
        }
      },
      {
        key: 'copy',
        label: '复制',
        icon: <CopyOutlined />,
        onClick: (e) => {
          e.domEvent.stopPropagation();
          handleCopy(item.content);
        }
      },
      {
        key: 'favorite',
        label: item.favorite ? '取消收藏' : '收藏',
        icon: item.favorite ? <StarFilled /> : <StarOutlined />,
        onClick: (e) => {
          e.domEvent.stopPropagation();
          toggleFavorite(item);
        }
      },
      {
        key: 'pin',
        label: item.pinned ? '取消置顶' : '置顶',
        icon: item.pinned ? <PushpinFilled /> : <PushpinOutlined />,
        onClick: (e) => {
          e.domEvent.stopPropagation();
          togglePin(item);
        }
      },
      {
        type: 'divider'
      },
      {
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: (e) => {
          e.domEvent.stopPropagation();
          handleDelete(item.id);
        }
      }
    ];
  };
  
  return (
    <div className={`float-clipboard-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
      {contextHolder}
      
      {/* 顶部工具栏 */}
      <div className="float-clipboard-header">
        <Space>
          <Tooltip title="关闭窗口">
            <Button 
              type="text" 
              icon={<CloseOutlined />} 
              onClick={closeWindow}
              className="float-header-button"
            />
          </Tooltip>
          <Tooltip title="设置">
            <Button 
              type="text" 
              icon={<SettingOutlined />} 
              onClick={openSettings}
              className="float-header-button"
            />
          </Tooltip>
        </Space>
        
        <Search
          placeholder="搜索剪贴板内容"
          onSearch={handleSearch}
          style={{ width: 200 }}
          className="float-search"
        />
        
        <Space>
          <Tooltip title={filterOptions.showFavoritesOnly ? "显示全部" : "只看收藏"}>
            <Button
              type={filterOptions.showFavoritesOnly ? "primary" : "text"}
              icon={<StarOutlined />}
              onClick={toggleShowFavoritesOnly}
              className="float-header-button"
            />
          </Tooltip>
          <Tooltip title={filterOptions.showPinnedOnly ? "显示全部" : "只看置顶"}>
            <Button
              type={filterOptions.showPinnedOnly ? "primary" : "text"}
              icon={<PushpinOutlined />}
              onClick={toggleShowPinnedOnly}
              className="float-header-button"
            />
          </Tooltip>
        </Space>
      </div>
      
      <Divider style={{ margin: '8px 0' }} />
      
      {/* 剪贴板列表 */}
      <div className="float-clipboard-list">
        {loading ? (
          <div className="float-loading">加载中...</div>
        ) : filteredItems.length > 0 ? (
          <List
            dataSource={filteredItems}
            rowKey="id"
            renderItem={(item) => (
              <List.Item className="float-list-item">
                <div className="float-item-content" onClick={() => handleCopy(item.content)}>
                  <div className="float-item-text">{formatContent(item.content)}</div>
                  <div className="float-item-meta">
                    <Space size={4}>
                      {item.category && (
                        <Tag color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                          {item.category}
                        </Tag>
                      )}
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        {formatTime(item.timestamp)}
                      </Text>
                    </Space>
                  </div>
                </div>
                <div className="float-item-actions">
                  <Space>
                    <Tooltip title="翻译">
                      <Button
                        type="text"
                        size="small"
                        icon={<TranslationOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTranslate(item);
                        }}
                      />
                    </Tooltip>
                    <Dropdown
                      menu={{ items: getDropdownMenuItems(item) }}
                      placement="bottomRight"
                      trigger={['click']}
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<MoreOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Dropdown>
                  </Space>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无数据" />
        )}
      </div>
      
      {/* 翻译结果弹窗 */}
      {translatingItem && (
        <TranslationResult 
          visible={showTranslationModal}
          onClose={() => setShowTranslationModal(false)}
          text={translatingItem.content}
        />
      )}
    </div>
  );
};

export default FloatClipboard; 