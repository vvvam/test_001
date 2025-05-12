import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Input, 
  List, 
  Empty, 
  Spin, 
  Button, 
  Tooltip, 
  Typography, 
  Tag, 
  Space, 
  Dropdown,
  Row,
  Col,
  Card,
  Radio,
  message,
  Drawer,
  Badge,
  Modal,
  DatePicker,
  Tabs,
  Form,
  Divider,
  Alert,
  InputNumber,
  Checkbox,
  Select
} from 'antd';
import type { MenuProps } from 'antd';
import { 
  CopyOutlined, 
  DeleteOutlined, 
  PushpinOutlined, 
  StarOutlined,
  TranslationOutlined,
  SyncOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  EditOutlined,
  RobotOutlined,
  DeleteFilled,
  ClearOutlined,
  DownOutlined,
  UpOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  StarFilled,
  SortAscendingOutlined,
  UnorderedListOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EllipsisOutlined,
  LoadingOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { format, parseISO, isToday, startOfDay, endOfDay, isThisWeek, isThisMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useClipboardStore } from '../store/clipboardStore';
import { ClipboardItem, ClearOption } from '../models/clipboard';
import { 
  PREDEFINED_CATEGORIES, 
  getCategoryColor, 
  getCategoryLabel,
  getAllCategories
} from '../constants/categories';
import { useTheme } from '../context/ThemeContext';
import useRoleStore from '../store/roleStore';
import useAnalysisStore from '../store/analysisStore';
import './Home.css';
import dayjs from 'dayjs';
import locale from 'antd/es/date-picker/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import VirtualList from 'rc-virtual-list';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import CategoryTag from '../components/CategoryTag';
import MarkdownRenderer from '../components/MarkdownRenderer';
import TranslationResult from '../components/TranslationResult';

// 启用weekday和localeData插件
dayjs.extend(weekday);
dayjs.extend(localeData);

const { Search } = Input;
const { Text, Paragraph, Title } = Typography;

// 高亮显示搜索关键词的函数
const highlightSearchText = (content: string, searchText?: string, isDarkMode?: boolean) => {
  if (!searchText || !content) {
    return content;
  }
  
  const parts = content.split(new RegExp(`(${searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  
  return (
    <>
      {parts.map((part, index) => 
        part.toLowerCase() === searchText.toLowerCase() ? (
          <span key={index} style={{ 
            backgroundColor: isDarkMode ? 'rgba(24, 144, 255, 0.25)' : 'rgba(24, 144, 255, 0.15)', 
            color: isDarkMode ? '#40a9ff' : '#1890ff',
            padding: '0 2px',
            borderRadius: '2px'
          }}>
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};

// 定义AI分析组件相关状态和接口
interface AIAnalysisState {
  selectedItems: string[];
  timeRange: 'today' | 'week' | 'month' | 'custom' | null;
  customStartDate: Date | null;
  customEndDate: Date | null;
  selectedRole: string | null;
  isAnalyzing: boolean;
  analysisResult: string | null;
  step: 'select' | 'role' | 'result';
}

// 渲染分类标签函数
const renderCategoryTag = (category: string, isDarkMode: boolean) => {
  if (!category) return null;

  const color = getCategoryColor(category);
  const label = getCategoryLabel(category);
  
  return (
    <Tag
      color={color}
      style={{
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        display: 'inline-block',
        opacity: 0.9,
        transition: 'all 0.2s ease',
      }}
    >
      {label}
    </Tag>
  );
};

// 使用React.memo优化列表项组件渲染
const ClipboardListItem = memo(({ 
  item, 
  index, 
  isExpanded, 
  toggleExpand, 
  showItemDetails, 
  handleAnalyzeItem,
  copyToClipboard,
  favoriteItem,
  pinItem,
  removeItem,
  isDarkMode,
  getCategoryColor,
  getCategoryLabel,
  searchText,
  handleTranslate,
  getDropdownMenuItems
}: {
  item: ClipboardItem;
  index: number;
  isExpanded: (id: string) => boolean;
  toggleExpand: (id: string, e: React.MouseEvent) => void;
  showItemDetails: (item: ClipboardItem) => void;
  handleAnalyzeItem: (item: ClipboardItem) => void;
  copyToClipboard: (id: string) => void;
  favoriteItem: (id: string) => void;
  pinItem: (id: string) => void;
  removeItem: (id: string) => void;
  isDarkMode: boolean;
  getCategoryColor: (category?: string) => string;
  getCategoryLabel: (category: string) => string;
  searchText?: string;
  handleTranslate: (item: ClipboardItem) => void;
  getDropdownMenuItems: (item: ClipboardItem) => MenuProps['items'];
}) => (
  <List.Item className="clipboard-list-item" key={item.id}>
    <div className={`list-item-container ${isDarkMode ? 'dark-theme' : ''}`} style={{
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      <div className="clipboard-card-content" style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
        <div className="clipboard-index">
          #{index + 1}
        </div>
        
        <div style={{ flex: 1 }}>
          <div 
            className={`clipboard-content ${isExpanded(item.id) ? '' : 'content-ellipsis'}`}
            style={{ cursor: 'pointer' }}
            onClick={() => showItemDetails(item)}
          >
            {highlightSearchText(item.content, searchText, isDarkMode)}
          </div>
          
          <div className="clipboard-footer">
            <div className="clipboard-info">
              <Space wrap>
                {item.category && renderCategoryTag(item.category, isDarkMode)}
                <span className="clipboard-timestamp">
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {format(new Date(item.timestamp), 'MM-dd HH:mm')}
                </span>
              </Space>
            </div>
            
            <div className="clipboard-actions">
              <Tooltip title="AI分析">
                <Button 
                  type="text" 
                  size="small"
                  icon={<RobotOutlined />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnalyzeItem(item);
                  }} 
                  className="ai-analysis-button"
                />
              </Tooltip>
              
              <Tooltip title="翻译">
                <Button 
                  type="text" 
                  size="small"
                  icon={<TranslationOutlined />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTranslate(item);
                  }} 
                  className="translate-button"
                />
              </Tooltip>
              
              <Tooltip title="复制到剪贴板">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<CopyOutlined />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(item.id);
                  }} 
                  className="action-button" 
                />
              </Tooltip>
              
              <Tooltip title={item.favorite ? "取消收藏" : "收藏"}>
                <Button 
                  type="text" 
                  size="small" 
                  icon={item.favorite ? <StarFilled /> : <StarOutlined />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    favoriteItem(item.id);
                  }}
                  style={{ color: item.favorite ? '#faad14' : undefined }} 
                  className="action-button"
                />
              </Tooltip>
              
              <Tooltip title={item.pinned ? "取消固定" : "固定"}>
                <Button 
                  type="text" 
                  size="small" 
                  icon={<PushpinOutlined />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    pinItem(item.id);
                  }}
                  style={{ color: item.pinned ? '#1890ff' : undefined }} 
                  className="action-button"
                />
              </Tooltip>
              
              <Dropdown 
                menu={{ 
                  items: getDropdownMenuItems(item)
                }} 
                placement="bottomRight"
                overlayClassName={isDarkMode ? "dark-theme" : ""}
                trigger={['click']}
              >
                <Button 
                  type="text" 
                  size="small" 
                  icon={<MoreOutlined />} 
                  className="action-button dropdown-more-btn" 
                />
              </Dropdown>
            </div>
          </div>
        </div>
        
        {!isExpanded(item.id) && item.content.length > 150 && (
          <Button 
            type="link" 
            size="small" 
            onClick={(e) => toggleExpand(item.id, e)}
            icon={<DownOutlined />}
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            展开
          </Button>
        )}
        {isExpanded(item.id) && (
          <Button 
            type="link" 
            size="small" 
            onClick={(e) => toggleExpand(item.id, e)}
            icon={<UpOutlined />}
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            收起
          </Button>
        )}
      </div>
    </div>
  </List.Item>
), (prevProps, nextProps) => {
  // 优化重渲染比较
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.content === nextProps.item.content &&
    prevProps.item.pinned === nextProps.item.pinned &&
    prevProps.item.favorite === nextProps.item.favorite &&
    prevProps.item.category === nextProps.item.category &&
    prevProps.item.translation === nextProps.item.translation &&
    prevProps.item.timestamp === nextProps.item.timestamp &&
    prevProps.index === nextProps.index &&
    prevProps.isExpanded(prevProps.item.id) === nextProps.isExpanded(nextProps.item.id) &&
    prevProps.isDarkMode === nextProps.isDarkMode &&
    prevProps.searchText === nextProps.searchText
  );
});

const Home: React.FC = () => {
  const { 
    items,
    filteredItems, 
    loading, 
    searchText, 
    setSearchText,
    pinItem,
    favoriteItem,
    removeItem,
    copyToClipboard,
    fetchItems,
    translateItem,
    summarizeItem,
    categorizeItem,
    editItem,
    setShowFavoritesOnly,
    setShowPinnedOnly,
    setSelectedCategory,
    showFavoritesOnly,
    showPinnedOnly,
    selectedCategory,
    clearAll,
    clearItems,
    setupEventListeners,
    initializeStore,
    isInitialized
  } = useClipboardStore();
  
  const { isDarkMode } = useTheme();
  
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [currentItem, setCurrentItem] = useState<ClipboardItem | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  
  const [showAIAnalysisModal, setShowAIAnalysisModal] = useState(false);
  const [aiAnalysisState, setAIAnalysisState] = useState<AIAnalysisState>({
    selectedItems: [],
    timeRange: null,
    customStartDate: null,
    customEndDate: null,
    selectedRole: null,
    isAnalyzing: false,
    analysisResult: null,
    step: 'select'
  });
  
  const [filterDateRange, setFilterDateRange] = useState<{
    type: 'today' | 'week' | 'month' | 'custom' | '' | null;
    startDate: Date | null;
    endDate: Date | null;
  }>({
    type: null,
    startDate: null,
    endDate: null
  });
  
  const [monitorEnabled, setMonitorEnabled] = useState<boolean>(true);
  
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [translatingItem, setTranslatingItem] = useState<ClipboardItem | null>(null);
  
  const toggleExpand = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }, []);
  
  const isExpanded = useCallback((id: string) => {
    return !!expandedItems[id];
  }, [expandedItems]);
  
  const { roles, loadRoles } = useRoleStore();
  const { setAnalysisData } = useAnalysisStore();
  
  useEffect(() => {
    loadRoles();
  }, [loadRoles]);
  
  // 增加refs用于滚动容器
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listHeight = 600; // 默认列表高度
  const itemHeight = 140; // 估计每个列表项高度

  // 使用useMemo缓存排序后的items，减少重复排序
  const sortedItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    
    return [...items].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return b.timestamp - a.timestamp;
    });
  }, [items]);

  // 优化过滤逻辑
  const applyFilters = useCallback(() => {
    if (!sortedItems || sortedItems.length === 0) return [];
    
    return sortedItems.filter(item => {
      // 使用toLowerCase()进行一次性转换，避免多次调用
      const searchLower = searchText?.toLowerCase() || '';
      const contentLower = searchText ? item.content.toLowerCase() : '';
      
      if (searchText && !contentLower.includes(searchLower)) {
        return false;
      }
      
      if (showFavoritesOnly && !item.favorite) {
        return false;
      }
      
      if (showPinnedOnly && !item.pinned) {
        return false;
      }
      
      if (selectedCategory && item.category !== selectedCategory) {
        return false;
      }
      
      if (filterDateRange.type && filterDateRange.type !== 'custom' && filterDateRange.startDate) {
        const itemDate = new Date(item.timestamp);
        return itemDate >= filterDateRange.startDate && itemDate <= (filterDateRange.endDate || new Date());
      }
      
      if (filterDateRange.type === 'custom' && filterDateRange.startDate && filterDateRange.endDate) {
        const itemDate = new Date(item.timestamp);
        return itemDate >= filterDateRange.startDate && itemDate <= filterDateRange.endDate;
      }
      
      return true;
    });
  }, [sortedItems, searchText, showFavoritesOnly, showPinnedOnly, selectedCategory, filterDateRange]);

  // 使用useMemo优化列表项渲染
  const optimizedFilteredItems = useMemo(() => {
    return applyFilters();
  }, [applyFilters]);

  // 创建带索引的列表数据
  const optimizedFilteredItemsWithIndex = useMemo(() => {
    return optimizedFilteredItems.map((item, index) => ({
      item,
      index
    }));
  }, [optimizedFilteredItems]);

  // 优化数据加载
  useEffect(() => {
    const initialize = async () => {
      setLocalLoading(true);
      try {
        await initializeStore();
        // 批量更新状态以减少渲染次数
        const batchUpdates = async () => {
          await fetchItems();
          const hasShownClearTip = localStorage.getItem('hasShownClearTip');
          if (!hasShownClearTip) {
            setTimeout(() => {
              message.info({
                content: (
                  <div>
                    
                  </div>
                ),
                duration: 6,
                icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />
              });
              localStorage.setItem('hasShownClearTip', 'true');
            }, 1000);
          }
          setLocalLoading(false);
        };
        batchUpdates();
      } catch (error) {
        console.error('初始化失败:', error);
        setLocalLoading(false);
      }
    };
    
    initialize();
  }, [initializeStore, fetchItems]);

  // 更新到store的状态
  useEffect(() => {
    if (items.length > 0) {
      const filteredResults = applyFilters();
      // 只有当过滤结果发生变化时才更新状态
      if (JSON.stringify(filteredResults.map(item => item.id)) !== 
          JSON.stringify(filteredItems.map(item => item.id))) {
        useClipboardStore.setState({ filteredItems: filteredResults });
      }
    }
  }, [items, searchText, showFavoritesOnly, showPinnedOnly, selectedCategory, filterDateRange, applyFilters, filteredItems]);

  // 添加自动刷新
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (!loading && !localLoading) {
        fetchItems();
      }
    }, 30000); // 30秒刷新一次
    
    return () => clearInterval(refreshInterval);
  }, [fetchItems, loading, localLoading]);

  // 优化刷新函数，使用防抖处理
  const handleManualRefresh = useCallback(async () => {
    if (localLoading) return; // 已经在加载中，避免重复请求
    
    setLocalLoading(true);
    try {
      await fetchItems();
      message.success('刷新成功');
    } catch (error) {
      console.error('刷新失败:', error);
      message.error('刷新失败');
    } finally {
      setTimeout(() => {
        setLocalLoading(false);
      }, 300);
    }
  }, [fetchItems, localLoading]);

  // 虚拟列表的滚动事件处理函数
  const onListScroll = useCallback((e: React.UIEvent<HTMLElement, UIEvent>) => {
    // 如果需要处理滚动事件，可以在这里添加逻辑
  }, []);

  const showItemDetails = useCallback((item: ClipboardItem) => {
    setCurrentItem(item);
    setEditContent(item.content);
    setEditMode(false);
    setShowDetailsDrawer(true);
  }, []);
  
  const handleCategoryChange = useCallback((id: string, category: string) => {
    categorizeItem(id, category);
    message.success(`已将内容分类为 ${getCategoryLabel(category)}`);
  }, [categorizeItem]);
  
  const handleAnalyzeItem = (item: ClipboardItem) => {
    setAIAnalysisState({
      ...aiAnalysisState,
      selectedItems: [item.id],
      step: 'select'
    });
    setShowAIAnalysisModal(true);
  };
  
  const handleClearOption = useCallback((option: ClearOption) => {
    setShowClearModal(false);
    clearItems(option);
  }, [clearItems]);
  
  const isLoading = loading || localLoading;

  const filtered = filteredItems.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return b.timestamp - a.timestamp;
  });
  
  const filteredItemsWithIndex = useMemo(() => {
    return filteredItems.map((item, index) => ({
      item,
      index
    }));
  }, [filteredItems]);

  const navigate = useNavigate();

  const handleTimeRangeSelect = useCallback((range: 'today' | 'week' | 'month' | 'custom' | null) => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = now;
    
    switch (range) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        break;
      default:
        startDate = null;
        endDate = null;
    }
    
    setAIAnalysisState(prev => ({
      ...prev,
      timeRange: range,
      customStartDate: startDate,
      customEndDate: endDate
    }));
    
    if (range !== null && range !== 'custom') {
      const filtered = items.filter(item => {
        const itemDate = new Date(item.timestamp);
        return startDate && itemDate >= startDate && itemDate <= now;
      });
      
      setAIAnalysisState(prev => ({
        ...prev,
        selectedItems: filtered.map(item => item.id)
      }));
    }
  }, [items]);
  
  const toggleItemSelection = useCallback((item: ClipboardItem) => {
    setAIAnalysisState(prev => {
      const isSelected = prev.selectedItems.some(i => i === item.id);
      
      if (isSelected) {
        return {
          ...prev,
          selectedItems: prev.selectedItems.filter(i => i !== item.id)
        };
      } else {
        return {
          ...prev,
          selectedItems: [...prev.selectedItems, item.id]
        };
      }
    });
  }, []);
  
  const selectAllItems = useCallback(() => {
    setAIAnalysisState(prev => ({
      ...prev,
      selectedItems: optimizedFilteredItems.map(item => item.id)
    }));
  }, [optimizedFilteredItems]);
  
  const resetAIAnalysis = useCallback(() => {
    setAIAnalysisState({
      selectedItems: [],
      timeRange: null,
      customStartDate: null,
      customEndDate: null,
      selectedRole: null,
      isAnalyzing: false,
      analysisResult: null,
      step: 'select'
    });
  }, []);

  const openAIAnalysisModal = useCallback(() => {
    resetAIAnalysis();
    setShowAIAnalysisModal(true);
  }, [resetAIAnalysis]);

  const closeAIAnalysisModal = useCallback(() => {
    setShowAIAnalysisModal(false);
    resetAIAnalysis();
  }, [resetAIAnalysis]);

  const getDefaultRoleId = useCallback(() => {
    const defaultRole = roles.find(role => (role as any).is_default === true);
    if (defaultRole) return defaultRole.id;
    
    if (roles.length > 0) return roles[0].id;
    
    return null;
  }, [roles]);
  
  const proceedWithAnalysis = useCallback((selectedItemsData: ClipboardItem[]) => {
    const defaultRoleId = getDefaultRoleId();
    if (!defaultRoleId) {
      message.error('无可用角色，请先创建角色');
      return;
    }
    
    try {
      if (selectedItemsData.length === 1) {
        // 单条内容分析
        const clipboardItem = selectedItemsData[0];
        setAnalysisData({
          clipboardId: clipboardItem.id,
          content: clipboardItem.content,
          isMultipleItems: false,
          roleId: defaultRoleId,
          timestamp: Date.now()
        });
      } else {
        // 多条内容分析
        // 创建更紧凑的内容格式
        const formattedContent = selectedItemsData
          .map((item, index) => {
            // 限制每个条目的最大长度，但保留前后部分
            const maxItemLength = 5000; // 每条内容的最大字符数
            let content = item.content;
            
            if (content.length > maxItemLength) {
              const halfLength = Math.floor(maxItemLength / 2);
              content = content.substring(0, halfLength) + 
                       "\n...(内容已截断)...\n" + 
                       content.substring(content.length - halfLength);
            }
            
            return `Content ${index + 1}: ${content}`;
          })
          .join('\n\n----------------\n\n');
        
        // 优化rawItems，只保留必要信息
        const rawItems = selectedItemsData.map(item => ({
          id: item.id,
          content: item.content.length > 500 ? 
            item.content.substring(0, 300) + "..." + item.content.substring(item.content.length - 200) : 
            item.content,
          timestamp: item.timestamp
        }));
        
        setAnalysisData({
          clipboardId: selectedItemsData[0].id,
          content: formattedContent,
          isMultipleItems: true,
          itemsCount: selectedItemsData.length,
          rawItems: rawItems,
          roleId: defaultRoleId,
          timestamp: Date.now()
        });
      }
      
      // 直接导航到聊天页面，无需URL参数
      navigate('/chat');
      
    } catch (error) {
      console.error('准备AI分析时发生错误:', error);
      Modal.error({
        title: '发送分析请求失败',
        content: (
          <div>
            <p>可能的原因：内容过大或内存限制</p>
            <p>建议：稍后重试或分批次选择内容进行分析</p>
          </div>
        ),
        okText: '返回首页'
      });
    }
  }, [getDefaultRoleId, navigate, setAnalysisData]);
  
  const handleAnalyzeItems = useCallback(() => {
    const selectedItemsData = aiAnalysisState.selectedItems
      .map(id => items.find(item => item.id === id))
      .filter((item): item is ClipboardItem => item !== undefined);
    
    if (selectedItemsData.length === 0) {
      message.error('请至少选择一条记录');
      return;
    }
    
    proceedWithAnalysis(selectedItemsData);
  }, [aiAnalysisState.selectedItems, items, proceedWithAnalysis]);
  
  const toggleSelectItem = useCallback((itemId: string) => {
    setAIAnalysisState(prev => {
      const isSelected = prev.selectedItems.includes(itemId);
      
      if (isSelected) {
        return {
          ...prev,
          selectedItems: prev.selectedItems.filter(id => id !== itemId)
        };
      } else {
        return {
          ...prev,
          selectedItems: [...prev.selectedItems, itemId]
        };
      }
    });
  }, []);
  
  const handleFilterTimeRangeSelect = useCallback((range: 'today' | 'week' | 'month' | 'custom' | '' | null) => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = now;
    
    // 空字符串视为null，清除筛选
    if (range === '') {
      range = null;
    }
    
    switch (range) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        break;
      default:
        startDate = null;
        endDate = null;
    }
    
    setFilterDateRange({
      type: range,
      startDate,
      endDate
    });
  }, []);

  const [roleSearchText, setRoleSearchText] = useState('');
  
  const filteredRoles = useMemo(() => {
    if (!roleSearchText.trim()) return roles;
    
    return roles.filter(role => 
      role.name.toLowerCase().includes(roleSearchText.toLowerCase()) || 
      role.description.toLowerCase().includes(roleSearchText.toLowerCase())
    );
  }, [roles, roleSearchText]);

  const renderAIAnalysisModal = () => (
    <Modal
      title="选择内容进行分析"
      open={showAIAnalysisModal}
      onCancel={closeAIAnalysisModal}
      footer={[
        <Button key="cancel" onClick={closeAIAnalysisModal}>取消</Button>,
        <Button
          key="analyze"
          type="primary"
          disabled={aiAnalysisState.selectedItems.length === 0}
          onClick={handleAnalyzeItems}
        >
          开始分析 ({aiAnalysisState.selectedItems.length} 项)
        </Button>
      ]}
      width={800}
    >
      <div style={{ marginBottom: '16px' }}>
        <Text>点击选择要分析的内容</Text>
        {aiAnalysisState.selectedItems.length > 0 && (
          <Button
            type="link"
            size="small"
            onClick={() => setAIAnalysisState(prev => ({ ...prev, selectedItems: [] }))}
            style={{ marginLeft: '8px' }}
          >
            清除选择
          </Button>
        )}
        <Button
          type="link"
          size="small"
          onClick={selectAllItems}
          style={{ marginLeft: '8px' }}
        >
          全选
        </Button>
      </div>
      
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <VirtualList
          data={optimizedFilteredItemsWithIndex}
          height={400}
          itemHeight={120}
          itemKey={(item) => item.item.id}
        >
          {(item) => {
            const isSelected = aiAnalysisState.selectedItems.includes(item.item.id);
            return (
              <List.Item
                key={item.item.id}
                onClick={() => toggleSelectItem(item.item.id)}
                style={{
                  cursor: 'pointer',
                  padding: '12px',
                  marginBottom: '8px',
                  border: isSelected ? '1px solid #1890ff' : '1px solid #f0f0f0',
                  borderRadius: '8px',
                  backgroundColor: isSelected ? 'rgba(24, 144, 255, 0.1)' : 'white'
                }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <Tag color={isSelected ? 'blue' : 'default'}>
                        {isSelected ? '已选择' : `项目 ${item.index + 1}`}
                      </Tag>
                      <Tag color="cyan">{new Date(item.item.timestamp).toLocaleString('zh-CN')}</Tag>
                    </div>
                    <div>
                      {item.item.favorite && <Tag color="gold">收藏</Tag>}
                      {item.item.pinned && <Tag color="purple">置顶</Tag>}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '10px',
                      backgroundColor: '#f9f9f9',
                      borderRadius: '4px',
                      maxHeight: '80px',
                      overflowY: 'auto'
                    }}
                  >
                    <Typography.Paragraph
                      ellipsis={{ rows: 2, expandable: false }}
                      style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                    >
                      {highlightSearchText(item.item.content, searchText, isDarkMode)}
                    </Typography.Paragraph>
                  </div>
                </div>
              </List.Item>
            );
          }}
        </VirtualList>
      </div>
    </Modal>
  );

  const handleNextStep = () => {
    handleAnalyzeItems();
  };

  // 添加全局错误处理
  useEffect(() => {
    // 处理未捕获的Promise错误
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('未处理的Promise错误:', event.reason);
      
      // 检查是否是网络相关错误
      if (event.reason instanceof TypeError || 
          (event.reason && event.reason.message && 
           (event.reason.message.includes('network') || 
            event.reason.message.includes('failed')))) {
        Modal.error({
          title: '网络错误',
          content: (
            <div>
              <p>发生网络错误，可能是请求内容过大或网络连接中断</p>
              <p>请减少选择的内容数量或稍后重试</p>
            </div>
          ),
          okText: '返回首页',
          onOk: () => {
            window.location.href = '/';
          }
        });
      }
    };

    // 添加全局的错误处理器
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // 添加HTTP错误状态码的监听
  useEffect(() => {
    const originalFetch = window.fetch;
    
    window.fetch = async function(...args) {
      try {
        const response = await originalFetch.apply(this, args);
        
        // 检查是否有错误状态码
        if (!response.ok && [413, 414, 431, 500, 502, 503, 504].includes(response.status)) {
          console.error('HTTP错误:', response.status, response.statusText);
          
          // 显示友好的错误提示并提供返回按钮
          Modal.error({
            title: `请求错误 (${response.status})`,
            content: (
              <div>
                <p>发送数据时出现错误，可能是内容过大或服务器暂时无法处理</p>
                <p>建议：减少选择的内容数量或稍后重试</p>
              </div>
            ),
            okText: '返回首页',
            onOk: () => {
              window.location.href = '/';
            }
          });
        }
        
        return response;
      } catch (error) {
        console.error('Fetch错误:', error);
        throw error;
      }
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // 获取剪贴板监控状态
  const fetchMonitorStatus = async () => {
    try {
      const status = await invoke('get_clipboard_monitor_status');
      setMonitorEnabled(status as boolean);
    } catch (error) {
      console.error('获取剪贴板监控状态失败:', error);
    }
  };
  
  // 在组件挂载时获取剪贴板监控状态
  useEffect(() => {
    fetchMonitorStatus();
  }, []);
  
  // 切换剪贴板监控状态
  const toggleMonitor = async () => {
    try {
      const newStatus = await invoke('toggle_clipboard_monitor');
      setMonitorEnabled(newStatus as boolean);
      message.success(newStatus ? '已启动剪贴板监听' : '已暂停剪贴板监听');
    } catch (error) {
      console.error('切换剪贴板监控状态失败:', error);
      message.error('操作失败，请重试');
    }
  };

  const renderFilterDrawer = () => (
    <Drawer
      title="筛选选项"
      placement="right"
      onClose={() => setShowFilterDrawer(false)}
      open={showFilterDrawer}
      width={300}
      className="glass-drawer"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={5}>收藏与固定</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button 
              type={showFavoritesOnly ? "primary" : "default"}
              icon={<StarOutlined />} 
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              style={{ width: '100%' }}
            >
              {showFavoritesOnly ? "取消只看收藏" : "只看收藏内容"}
            </Button>
            
            <Button 
              type={showPinnedOnly ? "primary" : "default"}
              icon={<PushpinOutlined />} 
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              style={{ width: '100%' }}
            >
              {showPinnedOnly ? "取消只看固定" : "只看固定内容"}
            </Button>
          </Space>
        </div>
        
        <div>
          <Title level={5}>时间范围</Title>
          <Radio.Group 
            value={filterDateRange.type} 
            onChange={(e) => handleFilterTimeRangeSelect(e.target.value)}
            buttonStyle="solid"
            style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: '8px' }}
          >
            <Radio.Button value="today">今天</Radio.Button>
            <Radio.Button value="week">本周</Radio.Button>
            <Radio.Button value="month">本月</Radio.Button>
            <Radio.Button value="custom">自定义</Radio.Button>
            <Radio.Button value="">全部</Radio.Button>
          </Radio.Group>
          
          {filterDateRange.type === 'custom' && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <DatePicker
                placeholder="开始日期"
                locale={locale}
                showTime={{ format: 'HH:mm:ss' }}
                format="YYYY-MM-DD HH:mm:ss"
                value={filterDateRange.startDate ? dayjs(filterDateRange.startDate) : null}
                onChange={(date) => {
                  setFilterDateRange(prev => ({
                    ...prev,
                    startDate: date ? date.toDate() : null
                  }));
                }}
                style={{ width: '100%' }}
              />
              <DatePicker
                placeholder="结束日期"
                locale={locale}
                showTime={{ format: 'HH:mm:ss' }}
                format="YYYY-MM-DD HH:mm:ss"
                value={filterDateRange.endDate ? dayjs(filterDateRange.endDate) : null}
                onChange={(date) => {
                  setFilterDateRange(prev => ({
                    ...prev,
                    endDate: date ? date.toDate() : null
                  }));
                }}
                style={{ width: '100%' }}
              />
              <Button 
                type="primary"
                onClick={() => {
                  if (!filterDateRange.startDate || !filterDateRange.endDate) {
                    message.warning('请选择开始和结束日期');
                    return;
                  }
                }}
                style={{ marginTop: '8px' }}
              >
                应用时间筛选
              </Button>
            </div>
          )}
        </div>
        
        <div>
          <Title level={5}>按分类筛选</Title>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            <Tag 
              color={!selectedCategory ? '#1890ff' : 'default'}
              style={{ 
                padding: '4px 10px', 
                borderRadius: '12px',
                cursor: 'pointer', 
                fontSize: '14px',
                opacity: !selectedCategory ? 1 : 0.7
              }}
              onClick={() => setSelectedCategory(null)}
            >
              全部
            </Tag>
            
            {getAllCategories().filter(cat => cat.value !== 'all').map(category => (
              <Tag
                key={category.value}
                color={selectedCategory === category.value ? category.color : 'default'}
                style={{ 
                  padding: '4px 10px', 
                  borderRadius: '12px',
                  cursor: 'pointer', 
                  fontSize: '14px',
                  opacity: selectedCategory === category.value ? 1 : 0.7
                }}
                onClick={() => setSelectedCategory(category.value)}
              >
                {category.label}
              </Tag>
            ))}
          </div>
        </div>
      </Space>
    </Drawer>
  );

  const renderDetailsDrawer = () => (
    <Drawer
      title="内容详情"
      placement="right"
      onClose={() => {
        setShowDetailsDrawer(false);
        setEditMode(false);
      }}
      open={showDetailsDrawer}
      width={500}
      className="details-drawer glass-drawer"
      extra={
        currentItem && (
          <Space>
            <Tooltip title="复制">
              <Button icon={<CopyOutlined />} onClick={() => {
                if (currentItem) copyToClipboard(currentItem.id);
                message.success('已复制到剪贴板');
              }} />
            </Tooltip>
            <Tooltip title="删除">
              <Button danger icon={<DeleteOutlined />} onClick={() => {
                if (currentItem) {
                  removeItem(currentItem.id);
                  setShowDetailsDrawer(false);
                }
              }} />
            </Tooltip>
          </Space>
        )
      }
    >
      {currentItem ? (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <Title level={5} style={{ margin: 0 }}>内容</Title>
              {editMode ? (
                <Space>
                  <Button 
                    type="primary"
                    onClick={() => {
                      if (editContent !== currentItem.content && currentItem) {
                        editItem(currentItem.id, editContent)
                          .then(() => {
                            message.success('内容已更新');
                            setEditMode(false);
                            setShowDetailsDrawer(false);
                            setTimeout(() => {
                              fetchItems();
                            }, 300);
                          })
                          .catch(err => {
                            message.error('更新失败: ' + err);
                          });
                      } else {
                        setEditMode(false);
                      }
                    }}
                  >
                    保存
                  </Button>
                  <Button 
                    onClick={() => {
                      if (currentItem) {
                        setEditContent(currentItem.content);
                      }
                      setEditMode(false);
                    }}
                  >
                    取消
                  </Button>
                </Space>
              ) : (
                <Button 
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditContent(currentItem.content);
                    setEditMode(true);
                  }}
                >
                  编辑内容
                </Button>
              )}
            </div>
            <div className="content-box glass-effect" style={{ padding: 16, maxHeight: '300px', overflow: 'auto' }}>
              {editMode ? (
                <Input.TextArea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autoSize={{ minRows: 3, maxRows: 12 }}
                  style={{ width: '100%' }}
                />
              ) : (
                <Paragraph copyable style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentItem.content}</Paragraph>
              )}
            </div>
          </div>
          
          <div>
            <Title level={5}>时间</Title>
            <Text>{format(new Date(currentItem.timestamp), 'yyyy-MM-dd HH:mm:ss')}</Text>
          </div>
          
          <div>
            <Title level={5}>分类</Title>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {getAllCategories().filter(cat => cat.value !== 'all').map(category => (
                <Tag
                  key={category.value}
                  color={currentItem.category === category.value ? category.color : 'default'}
                  style={{ 
                    padding: '4px 10px', 
                    borderRadius: '12px',
                    cursor: 'pointer', 
                    fontSize: '14px',
                    opacity: currentItem.category === category.value ? 1 : 0.7
                  }}
                  onClick={() => handleCategoryChange(currentItem.id, category.value)}
                >
                  {category.label}
                </Tag>
              ))}
            </div>
          </div>
          
          <div>
            <Title level={5}>属性</Title>
            <Space wrap>
              <Button 
                type={currentItem.favorite ? "primary" : "default"}
                icon={<StarOutlined />}
                onClick={() => favoriteItem(currentItem.id)}
              >
                {currentItem.favorite ? "取消收藏" : "收藏"}
              </Button>
              
              <Button 
                type={currentItem.pinned ? "primary" : "default"}
                icon={<PushpinOutlined />}
                onClick={() => pinItem(currentItem.id)}
              >
                {currentItem.pinned ? "取消固定" : "固定"}
              </Button>
              
              <Button 
                icon={<RobotOutlined />}
                onClick={() => {
                  setShowDetailsDrawer(false);
                  setTimeout(() => {
                    handleAnalyzeItem(currentItem);
                  }, 100);
                }}
              >
                AI分析
              </Button>
            </Space>
          </div>
          
          {currentItem.translation && (
            <div>
              <Title level={5}>翻译</Title>
              <div className="translation-box glass-effect" style={{ padding: 16 }}>
                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentItem.translation}</Paragraph>
              </div>
            </div>
          )}
          
          {currentItem.summary && (
            <div>
              <Title level={5}>总结</Title>
              <div className="summary-box glass-effect" style={{ padding: 16 }}>
                <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentItem.summary}</Paragraph>
              </div>
            </div>
          )}
        </Space>
      ) : (
        <Empty description="未找到详情数据" />
      )}
    </Drawer>
  );

  // 处理翻译请求
  const handleTranslate = (item: ClipboardItem) => {
    setTranslatingItem(item);
    setShowTranslationModal(true);
  };
  
  // 修改菜单项
  const getDropdownMenuItems = useCallback((item: ClipboardItem): MenuProps['items'] => {
    return [
      {
        key: 'polish',
        label: '润色',
        icon: <EditOutlined />,
        onClick: (e) => {
          e.domEvent.stopPropagation();
          message.info('润色功能开发中');
        }
      },
      {
        key: 'continue',
        label: '续写',
        icon: <ArrowDownOutlined />,
        onClick: (e) => {
          e.domEvent.stopPropagation();
          message.info('续写功能开发中');
        }
      },
      {
        key: 'rewrite',
        label: '改写',
        icon: <SyncOutlined />,
        onClick: (e) => {
          e.domEvent.stopPropagation();
          message.info('改写功能开发中');
        }
      },
      {
        key: 'analyze',
        label: '分析',
        icon: <InfoCircleOutlined />,
        onClick: (e) => {
          e.domEvent.stopPropagation();
          message.info('分析功能开发中');
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
          removeItem(item.id);
        }
      }
    ];
  }, []);

  return (
    <div className={`home-container ${isDarkMode ? 'dark-theme' : ''}`}>
      <div className="glass-container">
        <div className="clear-clipboard-banner glass-container" style={{
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <Title level={4} style={{ 
              margin: 0,
              marginBottom: '4px',
              color: isDarkMode ? '#4dabff' : '#1890ff',
              fontWeight: 500
            }}>
              剪贴板历史
            </Title>
            <Text type="secondary" style={{ fontSize: '14px' }}>共 {filteredItemsWithIndex.length} 条记录</Text>
          </div>
          
          <Space size="small">
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={openAIAnalysisModal}
            >
              AI分析
            </Button>
            
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'all',
                    label: '清空所有',
                    icon: <DeleteFilled />,
                    danger: true,
                    onClick: () => {
                      Modal.confirm({
                        title: '确认清空',
                        content: '确定要清空所有剪贴板历史记录吗？此操作不可恢复。',
                        okText: '确认清空',
                        cancelText: '取消',
                        okButtonProps: { danger: true },
                        onOk: () => handleClearOption(ClearOption.ALL)
                      });
                    }
                  },
                  {
                    key: 'today',
                    label: '清空今天',
                    icon: <ClearOutlined />,
                    onClick: () => handleClearOption(ClearOption.TODAY)
                  },
                  {
                    key: 'week',
                    label: '清空本周',
                    icon: <ClearOutlined />,
                    onClick: () => handleClearOption(ClearOption.THIS_WEEK)
                  },
                  {
                    key: 'pinned',
                    label: '清空固定',
                    icon: <PushpinOutlined />,
                    onClick: () => handleClearOption(ClearOption.PINNED)
                  },
                  {
                    key: 'favorites',
                    label: '清空收藏',
                    icon: <StarOutlined />,
                    onClick: () => handleClearOption(ClearOption.FAVORITES)
                  },
                ]
              }}
            >
              <Button 
                danger
                icon={<DeleteOutlined />}
              >
                清空
              </Button>
            </Dropdown>
            
            <Button
              icon={monitorEnabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={toggleMonitor}
              style={{
                background: monitorEnabled 
                  ? (isDarkMode ? 'rgba(82, 196, 26, 0.2)' : 'rgba(82, 196, 26, 0.1)')
                  : undefined,
                color: monitorEnabled 
                  ? '#52c41a' 
                  : undefined
              }}
            >
              {monitorEnabled ? '监听中' : '已暂停'}
            </Button>
          </Space>
        </div>
        
        <div className="clipboard-toolbar glass-effect" style={{ 
          marginBottom: 24, 
          padding: '12px 16px',
          borderRadius: '12px'
        }}>
          <Row align="middle" gutter={[8, 12]}>
            <Col xs={24} sm={24} md={24} lg={24} xl={24}>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '8px', 
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <Search
                    placeholder="搜索剪贴板内容..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                    style={{ 
                      width: '200px',
                      borderRadius: '8px',
                    }}
                  />
                  
                  <Button 
                    type="default" 
                    icon={<SyncOutlined spin={isLoading} />} 
                    onClick={handleManualRefresh}
                    loading={isLoading}
                    disabled={isLoading}
                  >
                    刷新
                  </Button>
                  
                  <Button 
                    icon={<FilterOutlined />} 
                    onClick={() => setShowFilterDrawer(true)}
                    style={{
                      background: showFavoritesOnly || showPinnedOnly || !!selectedCategory 
                        ? (isDarkMode ? 'rgba(82, 196, 26, 0.15)' : 'rgba(82, 196, 26, 0.1)')
                        : undefined,
                      color: (showFavoritesOnly || showPinnedOnly || !!selectedCategory) 
                        ? '#52c41a' 
                        : undefined
                    }}
                  >
                    筛选
                  </Button>
                </div>
              </div>
            </Col>
          </Row>
          
          <div style={{ marginTop: '12px' }}>
            <Radio.Group 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              buttonStyle="solid"
              size="small"
              style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
            >
              <Radio.Button value={null} style={{ borderRadius: '16px' }}>
                全部
              </Radio.Button>
              {getAllCategories()
                .filter(cat => cat.value !== 'all')
                .map(category => (
                  <Radio.Button 
                    key={category.value} 
                    value={category.value}
                    style={{ 
                      borderRadius: '16px',
                      background: selectedCategory === category.value 
                        ? getCategoryColor(category.value) || '#1890ff' 
                        : undefined,
                      color: selectedCategory === category.value 
                        ? '#fff' 
                        : undefined,
                      borderColor: selectedCategory === category.value 
                        ? getCategoryColor(category.value) || '#1890ff' 
                        : undefined
                    }}
                  >
                    {category.label}
                  </Radio.Button>
                ))
              }
            </Radio.Group>
          </div>
        </div>
        
        <div className="clipboard-content-container glass-container" style={{ 
          padding: '20px', 
          minHeight: '400px',
        }}>
          <Spin spinning={isLoading} tip={isLoading ? "正在加载剪贴板数据..." : ""}>
            {optimizedFilteredItemsWithIndex.length > 0 ? (
              <div ref={listContainerRef} style={{ height: listHeight, overflow: 'auto' }}>
                <VirtualList
                  data={optimizedFilteredItemsWithIndex}
                  height={listHeight}
                  itemHeight={itemHeight}
                  itemKey={(item) => item.item.id}
                  onScroll={onListScroll}
                >
                  {(item) => (
                    <ClipboardListItem 
                      item={item.item} 
                      index={item.index}
                      isExpanded={isExpanded}
                      toggleExpand={toggleExpand}
                      showItemDetails={showItemDetails}
                      handleAnalyzeItem={handleAnalyzeItem}
                      copyToClipboard={copyToClipboard}
                      favoriteItem={favoriteItem}
                      pinItem={pinItem}
                      removeItem={removeItem}
                      isDarkMode={isDarkMode}
                      getCategoryColor={getCategoryColor}
                      getCategoryLabel={getCategoryLabel}
                      searchText={searchText}
                      handleTranslate={handleTranslate}
                      getDropdownMenuItems={getDropdownMenuItems}
                    />
                  )}
                </VirtualList>
              </div>
            ) : (
              <div style={{ padding: '40px 0' }}>
                <Empty 
                  description={
                    <Text className="neon-text">
                      {isLoading 
                        ? "正在加载剪贴板数据..." 
                        : "暂无剪贴板记录"
                      }
                    </Text>
                  } 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </Spin>
        </div>
        
        {renderFilterDrawer()}
        {renderDetailsDrawer()}
        {renderAIAnalysisModal()}
        
        {/* 翻译结果弹窗 */}
        {translatingItem && (
          <TranslationResult 
            visible={showTranslationModal}
            onClose={() => setShowTranslationModal(false)}
            text={translatingItem.content}
          />
        )}
      </div>
    </div>
  );
};

export default Home; 