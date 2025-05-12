import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Avatar, List, Typography, Spin, Divider, Select, Modal, Tooltip, Card, message, Tag, Space, Tabs, Drawer, Dropdown } from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined, SettingOutlined, ClearOutlined, PaperClipOutlined, FileTextOutlined, ExpandOutlined, OrderedListOutlined, StopOutlined, ArrowLeftOutlined, InfoCircleOutlined, HistoryOutlined, DeleteOutlined, EditOutlined, ImportOutlined, ExportOutlined, PlusCircleOutlined, MessageOutlined, FileAddOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { useChatStore } from '../store/chatStore';
import { useAISettingsStore } from '../store/aiSettingsStore';
import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_AI_PROVIDERS } from '../constants/aiProviders';
import { ClipboardReference, Message } from '../models/chat';
import { useNavigate } from 'react-router-dom';
import { ClipboardItem } from '../models/clipboard';
import { useChatUserPrefsStore } from '../store/chatUserPrefsStore';
import useAnalysisStore from '../store/analysisStore';
import RoleSelectionGrid from '../components/RoleSelectionGrid';
import ModelSelectionGrid from '../components/ModelSelectionGrid';
import MarkdownRenderer from '../components/MarkdownRenderer';
// 导入主题上下文
import { useTheme } from '../context/ThemeContext';
import '../styles/chat-dark-theme.css';
import { useClipboardStore } from '../store/clipboardStore';

// 角色类型定义 (如果Role接口中没有is_default字段，则在这里重新定义)
interface RoleWithDefault {
  id: string;
  name: string; 
  description: string;
  system_prompt: string;
  is_default?: boolean;
  created_at?: number;
  updated_at?: number;
}

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 先添加一个自定义hook来检测当前主题
const useThemeDetector = () => {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  
  useEffect(() => {
    // 初始检测
    const isDark = window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkTheme(isDark);
    
    // 监听主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const changeHandler = (e: MediaQueryListEvent) => setIsDarkTheme(e.matches);
    
    // 添加事件监听器
    mediaQuery.addEventListener('change', changeHandler);
    
    // 清理
    return () => mediaQuery.removeEventListener('change', changeHandler);
  }, []);
  
  return isDarkTheme;
};

// 添加自定义的媒体查询hook
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
};

const Chat: React.FC = () => {
  const {
    sessions,
    currentSession,
    isStreaming,
    createSession,
    setCurrentSession,
    sendMessage
  } = useChatStore();
  
  const [roles, setRoles] = useState<RoleWithDefault[]>([]);
  const { settings } = useAISettingsStore();
  const { defaultRoleId, defaultProviderId, setDefaultRole, setDefaultProvider } = useChatUserPrefsStore();
  const { analysisData, clearAnalysisData } = useAnalysisStore();
  const { updateAIAnalysisCount } = useClipboardStore();
  
  const [inputValue, setInputValue] = useState<string>('');
  const [showNewChatModal, setShowNewChatModal] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<string>(defaultRoleId || '');
  const [selectedProvider, setSelectedProvider] = useState<string>(defaultProviderId || 'Copy2AI');
  const [clipboardRef, setClipboardRef] = useState<ClipboardReference | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [newChatTab, setNewChatTab] = useState<string>('role');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [clipboardItems, setClipboardItems] = useState<ClipboardItem[]>([]);
  const [showClipboardModal, setShowClipboardModal] = useState<boolean>(false);
  const [selectedClipboardItems, setSelectedClipboardItems] = useState<ClipboardItem[]>([]);
  const navigate = useNavigate();
  
  const [showItemDetailsModal, setShowItemDetailsModal] = useState<boolean>(false);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [isMultipleItems, setIsMultipleItems] = useState<boolean>(false);
  
  // 使用主题上下文
  const { isDarkMode } = useTheme();
  
  // 添加历史记录相关状态
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [sessionRenameId, setSessionRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  
  const [autoCreationAttempted, setAutoCreationAttempted] = useState<boolean>(false);
  
  // 添加媒体查询判断小屏幕
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isMobileScreen = useMediaQuery('(max-width: 480px)');
  
  // 添加角色和模型设置状态
  const [showRoleModelDropdown, setShowRoleModelDropdown] = useState<boolean>(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState<boolean>(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState<boolean>(false);
  const [applyingSettings, setApplyingSettings] = useState<boolean>(false);
  
  // 加载角色列表
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const loadedRoles = await invoke<RoleWithDefault[]>('get_roles');
        if (loadedRoles && loadedRoles.length > 0) {
          setRoles(loadedRoles);
          // 如果有默认角色ID则使用，否则查找默认角色或使用第一个
          if (defaultRoleId) {
            setSelectedRole(defaultRoleId);
          } else if (loadedRoles.some(r => r.is_default)) {
            const defaultRole = loadedRoles.find(r => r.is_default);
            if (defaultRole) {
              setSelectedRole(defaultRole.id);
              setDefaultRole(defaultRole.id);
            }
          } else {
            setSelectedRole(loadedRoles[0].id);
            setDefaultRole(loadedRoles[0].id);
          }
        } else {
          console.warn('未加载到角色数据');
          message.warning('未能加载角色数据，将使用默认角色');
        }
      } catch (error) {
        console.error('加载角色失败:', error);
        message.error('加载角色失败，请检查网络连接');
      }
    };
    
    loadRoles();
  }, [defaultRoleId, setDefaultRole]);
  
  // 初始化默认提供商
  useEffect(() => {
    if (defaultProviderId) {
      setSelectedProvider(defaultProviderId);
    } else {
      const defaultProvider = 'Copy2AI';
      setSelectedProvider(defaultProvider);
      setDefaultProvider(defaultProvider);
    }
  }, [defaultProviderId, setDefaultProvider]);
  
  // 初始化加载时自动创建会话
  useEffect(() => {
    const initializeChat = async () => {
      // 仅在尚未尝试自动创建且没有当前会话时执行
      if (!autoCreationAttempted && !currentSession) {
        setAutoCreationAttempted(true); // 标记已尝试自动创建
        setLoading(true);
        try {
          console.log('开始初始化默认会话...');
          // 获取默认角色
          let rolePrompt: string | undefined;
          let roleId = defaultRoleId || selectedRole;
          
          try {
            const role = await invoke<RoleWithDefault>('get_role', { id: roleId });
            console.log('获取到角色:', role);
            rolePrompt = role?.system_prompt;
          } catch (error) {
            console.error('获取角色失败:', error);
            // 错误处理，尝试找出一个可用角色
            if (roles.length > 0) {
              console.log('使用角色列表中的第一个角色');
              rolePrompt = roles[0].system_prompt;
              roleId = roles[0].id;
            } else {
              // 如果没有可用角色，使用基础提示词
              console.log('使用基础提示词');
              rolePrompt = "你是一个运行在Copy2AI智能剪贴板的AI助手，擅长以风趣幽默、生动活泼的方式与用户交流，能够灵活运用各种emoji表情包增添趣味性。你可以帮助用户针对剪贴板中的内容进行精准回答、高效翻译和简洁总结，同时还能提供实用的建议和有趣的见解，让用户在使用过程中感受到便捷与快乐。";
              roleId = "default";
            }
          }
          
          // 获取默认提供商
          let providerId = defaultProviderId || selectedProvider || 'Copy2AI';
          const provider = DEFAULT_AI_PROVIDERS.find(p => p.id === providerId);
          console.log('选择的提供商:', provider);
          
          if (provider) {
            console.log('创建新会话...');
            try {
              const newSession = createSession(
                provider,
                undefined,
                rolePrompt
              );
              console.log('会话创建成功:', newSession);
              
              // 保存用户选择
              if (roleId && roleId !== defaultRoleId) {
                setDefaultRole(roleId);
              }
              if (providerId && providerId !== defaultProviderId) {
                setDefaultProvider(providerId);
              }
              
              // 关闭模态框
              setShowNewChatModal(false);
            } catch (error) {
              console.error('会话创建失败:', error);
              setShowNewChatModal(true);
            }
          } else {
            // 没有找到指定提供商，尝试使用第一个可用的提供商
            if (DEFAULT_AI_PROVIDERS.length > 0) {
              const firstProvider = DEFAULT_AI_PROVIDERS[0];
              console.log('使用第一个可用提供商:', firstProvider);
              try {
                createSession(
                  firstProvider,
                  undefined,
                  rolePrompt
                );
                // 更新默认提供商
                setDefaultProvider(firstProvider.id);
                // 关闭模态框
                setShowNewChatModal(false);
              } catch (error) {
                console.error('使用第一个提供商创建会话失败:', error);
                setShowNewChatModal(true);
              }
            } else {
              console.warn('未找到任何提供商，显示手动选择对话框');
              setShowNewChatModal(true);
            }
          }
        } catch (error) {
          console.error('自动创建会话失败:', error);
          setShowNewChatModal(true);
        } finally {
          setLoading(false);
        }
      }
    };
    
    // 执行初始化
    initializeChat();
    
    // 依赖项不包含autoCreationAttempted，确保只在组件首次加载时执行
  }, [currentSession, defaultRoleId, defaultProviderId, selectedRole, selectedProvider, roles, createSession, setDefaultRole, setDefaultProvider]);
  
  // 消息区域滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.messages]);
  
  // 当全局状态中存在分析数据时，处理分析数据
  useEffect(() => {
    if (analysisData) {
      // 设置剪贴板引用
      setClipboardRef({
        id: analysisData.clipboardId,
        content: analysisData.content,
        timestamp: analysisData.timestamp,
        type: 'text'
      });
      
      // 增加AI分析次数
      console.log('从analysisData更新AI分析计数:', analysisData.clipboardId);
      updateAIAnalysisCount(analysisData.clipboardId);
      
      // 处理多条内容
      if (analysisData.isMultipleItems && analysisData.rawItems) {
        setDetailItems(analysisData.rawItems);
        setIsMultipleItems(true);
      }
      
      // 如果有角色ID，则选择该角色
      if (analysisData.roleId) {
        setSelectedRole(analysisData.roleId);
      }
      
      // 如果没有当前会话，则弹出新建会话框
      if (!currentSession) {
        setShowNewChatModal(true);
      }
      
      // 使用完数据后清空全局状态中的分析数据
      clearAnalysisData();
    } else {
      // 当没有全局分析数据时，继续尝试从URL参数获取信息
      const params = new URLSearchParams(window.location.search);
      
      // 检查是否有会话ID，从localStorage获取数据
      const sessionId = params.get('sessionId');
      if (sessionId) {
        try {
          const storedData = localStorage.getItem(sessionId);
          if (storedData) {
            const parsedData = JSON.parse(storedData);
            
            // 设置剪贴板引用
            setClipboardRef({
              id: parsedData.clipboardId,
              content: parsedData.content,
              timestamp: Date.now(),
              type: 'text'
            });
            
            // 处理多条内容
            if (parsedData.isMultipleItems && parsedData.rawItems) {
              try {
                const rawItems = JSON.parse(parsedData.rawItems);
                setDetailItems(rawItems);
                setIsMultipleItems(true);
              } catch (e) {
                console.error('解析多条内容失败', e);
              }
            }
            
            // 如果有角色ID，则选择该角色
            if (parsedData.roleId) {
              setSelectedRole(parsedData.roleId);
            }
            
            // 使用完后清除localStorage中的数据
            localStorage.removeItem(sessionId);
            
            // 如果没有当前会话，则弹出新建会话框
            if (!currentSession) {
              setShowNewChatModal(true);
            }
            
            return; // 已从localStorage获取数据，不需要继续处理URL参数
          }
        } catch (e) {
          console.error('从localStorage读取数据失败', e);
        }
      }
      
      // 常规URL参数处理
      const clipboardId = params.get('clipboardId');
      const clipboardContent = params.get('content');
      const roleId = params.get('roleId');
      const isMultiItems = params.get('isMultipleItems') === 'true';
      const rawItemsStr = params.get('rawItems');
      
      if (clipboardId && clipboardContent) {
        // 处理多条内容
        if (isMultiItems && rawItemsStr) {
          try {
            const rawItems = JSON.parse(rawItemsStr);
            setDetailItems(rawItems);
            setIsMultipleItems(true);
            
            // 重新格式化多条内容
            const formattedContent = rawItems
              .map((item: any, index: number) => `Content ${index + 1}: ${item.content}`)
              .join('\n\n----------------\n\n');
            
            setClipboardRef({
              id: clipboardId,
              content: formattedContent,
              timestamp: Date.now(),
              type: 'text'
            });
          } catch (e) {
            console.error('解析多条内容失败', e);
            // 解析失败时使用原始内容
            setClipboardRef({
              id: clipboardId,
              content: clipboardContent,
              timestamp: Date.now(),
              type: 'text'
            });
          }
        } else {
          // 单条内容直接设置
          setClipboardRef({
            id: clipboardId,
            content: clipboardContent,
            timestamp: Date.now(),
            type: 'text'
          });
        }
        
        // 如果URL中包含角色ID，则选择该角色
        if (roleId) {
          setSelectedRole(roleId);
        }
        
        // 如果没有当前会话，则弹出新建会话框
        if (!currentSession) {
          setShowNewChatModal(true);
        }
      }
    }
  }, [analysisData, clearAnalysisData, updateAIAnalysisCount, currentSession]);
  
  const handleSend = async () => {
    if (isStreaming) {
      // 如果正在流式响应中，则停止响应
      useChatStore.getState().stopStreaming();
      message.info('已停止AI响应');
      return;
    }

    if (!inputValue.trim() && !clipboardRef) return;
    
    // 如果有引用内容但没有输入文本，自动生成分析提示
    let messageContent = inputValue;
    if (!inputValue.trim() && clipboardRef) {
      if (isMultipleItems && detailItems.length > 0) {
        messageContent = `请根据你的角色设定，为用户准确的回复。`;
      } else {  
        messageContent = `请根据你的角色设定，为用户准确的回复。`;
      }
    }
    
    // 如果会话正在创建中，等待片刻再尝试发送
    if (!currentSession) {
      if (loading) {
        // 显示加载中消息
        message.loading({
          content: '正在准备会话环境...',
          duration: 2
        });
        
        // 设置轮询检查会话创建是否完成
        const checkSessionInterval = setInterval(() => {
          const currentState = useChatStore.getState();
          if (currentState.currentSession) {
            clearInterval(checkSessionInterval);
            // 会话创建完成，尝试发送消息
            sendMessageWhenReady(messageContent);
          }
        }, 500);
        
        // 设置超时，防止无限等待
        setTimeout(() => {
          clearInterval(checkSessionInterval);
          if (!useChatStore.getState().currentSession) {
            message.error('会话创建超时，请手动创建新会话');
            setShowNewChatModal(true);
          }
        }, 10000);
        
        // 清空输入框
        setInputValue('');
        return;
      } else {
        // 会话未创建，且不在加载状态，直接打开创建对话框
        message.info('请先创建会话');
        setShowNewChatModal(true);
        return;
      }
    }
    
    // 发送消息并包含剪贴板引用
    await sendMessage(messageContent, clipboardRef || undefined);
    
    // 如果存在剪贴板引用且有ID，更新分析次数
    if (clipboardRef && clipboardRef.id) {
      console.log('发送消息时更新AI分析计数:', clipboardRef.id);
      try {
        await updateAIAnalysisCount(clipboardRef.id);
        console.log('AI分析计数更新成功:', clipboardRef.id);
      } catch (error) {
        console.error('AI分析计数更新失败:', error);
      }
    }
    
    // 清空输入和引用
    setInputValue('');
    setClipboardRef(null);
    
    // 清除URL参数
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };
  
  // 当会话创建完成后发送消息的辅助函数
  const sendMessageWhenReady = async (content: string) => {
    try {
      // 重新获取当前会话状态
      const currentState = useChatStore.getState();
      if (currentState.currentSession) {
        // 发送消息
        await sendMessage(content, clipboardRef || undefined);
        
        // 如果存在剪贴板引用且有ID，更新分析次数
        if (clipboardRef && clipboardRef.id) {
          try {
            await updateAIAnalysisCount(clipboardRef.id);
          } catch (error) {
            console.error('AI分析计数更新失败:', error);
          }
        }
        
        // 清空剪贴板引用
        setClipboardRef(null);
      } else {
        message.error('会话创建失败，请手动创建新会话');
        setShowNewChatModal(true);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      message.error('发送消息失败，请重试');
    }
  };
  
  // 处理新建对话的函数，保持与角色和模型选择功能兼容
  const handleNewChat = async () => {
    try {
      setLoading(true);
      // 获取选中的角色
      let rolePrompt: string | undefined;
      
      try {
        const role = await invoke<RoleWithDefault>('get_role', { id: selectedRole });
        rolePrompt = role?.system_prompt;
        // 保存用户选择的角色作为默认值
        setDefaultRole(selectedRole);
      } catch (e) {
        console.error('获取角色失败:', e);
        message.warning('获取角色信息失败，将使用默认提示词');
      }
      
      const provider = DEFAULT_AI_PROVIDERS.find(p => p.id === selectedProvider);
      
      if (!provider) {
        console.error('未找到AI提供商', selectedProvider);
        message.error('未找到所选AI提供商');
        return;
      }
      
      // 保存用户选择的提供商作为默认值
      setDefaultProvider(selectedProvider);
      
      createSession(
        provider,
        undefined, // 系统提示词稍后设置
        rolePrompt // 角色提示词
      );
      
      // 更新当前状态，确保UI显示正确
      message.success(`已创建新对话，使用 ${getSelectedRoleName()} 角色和 ${getSelectedProviderName()} 模型`);
      setShowNewChatModal(false);
    } catch (error) {
      console.error('创建对话失败:', error);
      message.error('创建对话失败，请重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理角色变更
  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId);
  };
  
  // 处理提供商变更
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
  };
  
  const showContentDetails = (content: string) => {
    // 检测是否是多条内容
    if (isMultipleItems && detailItems.length > 0) {
      setShowItemDetailsModal(true);
    } else if (content) {
      // 单条内容时，只显示文本预览
      Modal.info({
        title: '引用内容详情',
        content: (
          <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {content}
            </Typography.Paragraph>
          </div>
        ),
        width: 600
      });
    }
  };

  // 定义主题相关的样式对象
  const themeStyles = {
    container: {
      backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
      color: isDarkMode ? '#e0e0e0' : 'inherit',
    },
    header: {
      background: isDarkMode ? 'linear-gradient(to right, #1a1a1a, #2a2a2a)' : 'linear-gradient(to right, #f0f2f5, #ffffff)',
      borderBottom: isDarkMode ? '1px solid #333' : '1px solid #eaeaea',
      boxShadow: isDarkMode ? '0 2px 5px rgba(0,0,0,0.2)' : '0 2px 5px rgba(0,0,0,0.05)',
      color: isDarkMode ? '#e0e0e0' : 'inherit',
    },
    messageContainer: {
      backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
    },
    userMessage: {
      background: isDarkMode ? 'rgba(30, 144, 255, 0.2)' : 'rgba(24, 144, 255, 0.1)',
      color: isDarkMode ? '#e0e0e0' : 'inherit',
      boxShadow: isDarkMode ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
    },
    assistantMessage: {
      background: isDarkMode ? 'rgba(82, 196, 26, 0.15)' : 'rgba(82, 196, 26, 0.1)',
      color: isDarkMode ? '#e0e0e0' : 'inherit',
      boxShadow: isDarkMode ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
    },
    inputContainer: {
      background: isDarkMode ? '#2a2a2a' : '#f9f9f9',
      borderTop: isDarkMode ? '1px solid #333' : '1px solid #eaeaea',
    },
    input: {
      backgroundColor: isDarkMode ? '#333' : '#fff',
      color: isDarkMode ? '#e0e0e0' : 'inherit',
      boxShadow: isDarkMode ? 'inset 0 1px 3px rgba(0,0,0,0.3)' : 'inset 0 1px 3px rgba(0,0,0,0.05)',
    },
    cardBackground: {
      backgroundColor: isDarkMode ? 'rgba(40, 40, 40, 0.6)' : 'rgba(24, 144, 255, 0.05)',
      borderLeft: isDarkMode ? '3px solid #1890ff' : '3px solid #1890ff',
    },
    divider: {
      borderColor: isDarkMode ? '#333' : '#eaeaea',
    },
    secondaryText: {
      color: isDarkMode ? '#aaa' : 'rgba(0, 0, 0, 0.45)',
    }
  };
  
  // 修改消息渲染函数，使用主题样式
  const renderMessageItem = (message: Message) => (
    <List.Item className={`message-item ${message.role === 'user' ? 'user-message' : 'ai-message'}`}>
      <div className="message-content" style={{ 
        display: 'flex', 
        width: '100%',
        flexDirection: isSmallScreen ? 'column' : 'row',
        padding: isSmallScreen ? '4px 0' : '8px 0'
      }}>
        <Avatar 
          icon={message.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
          style={{ 
            backgroundColor: message.role === 'user' ? '#1890ff' : '#52c41a',
            marginRight: isSmallScreen ? 0 : '10px',
            marginBottom: isSmallScreen ? '8px' : 0,
            flexShrink: 0,
            alignSelf: isSmallScreen ? 'flex-start' : 'flex-start'
          }}
          size={isSmallScreen ? "small" : "default"}
        />
        <div style={{ 
          flex: 1,
          maxWidth: '100%',
          overflowWrap: 'break-word'
        }}>
          {/* 剪贴板引用内容 */}
          {message.clipboardRef && (
            <Card 
              size="small" 
              style={{ 
                marginBottom: '8px', 
                ...themeStyles.cardBackground,
                cursor: 'pointer',
                width: '100%'
              }}
              onClick={() => showContentDetails(message.clipboardRef?.content || '')}
              hoverable
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {isMultipleItems ? (
                    <OrderedListOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                  ) : (
                    <FileTextOutlined style={{ marginRight: '8px', color: isDarkMode ? '#1890ff' : undefined }} />
                  )}
                  <Text type="secondary" style={{ fontSize: isSmallScreen ? '11px' : '12px', ...themeStyles.secondaryText }}>
                    {isMultipleItems 
                      ? `引用的多条内容 (${detailItems.length}条)` 
                      : '引用的剪贴板内容'}
                  </Text>
                </div>
                <Tooltip title="查看详情">
                  <ExpandOutlined style={{ color: '#1890ff' }} />
                </Tooltip>
              </div>
              <Paragraph 
                ellipsis={{ rows: isSmallScreen ? 2 : 3, expandable: true, symbol: '展开' }}
                style={{ marginBottom: 0, marginTop: '4px', color: isDarkMode ? '#e0e0e0' : undefined }}
              >
                {message.clipboardRef.content}
              </Paragraph>
            </Card>
          )}
          
          {/* 消息内容 - 根据角色使用不同的渲染方式 */}
          <div style={{ 
            ...(message.role === 'user' ? themeStyles.userMessage : themeStyles.assistantMessage),
            padding: isSmallScreen ? '8px 10px' : '12px',
            borderRadius: '12px',
            width: 'fit-content',
            maxWidth: '100%',
            marginBottom: '4px',
          }}>
            {message.role === 'user' ? (
              <Text style={{ 
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word',
                color: isDarkMode ? '#e0e0e0' : undefined,
                fontSize: isSmallScreen ? '14px' : '16px'
              }}>
                {message.content}
              </Text>
            ) : (
              // 使用Markdown渲染AI回复，同时确保深色模式和响应式样式正确应用
              <div className={isSmallScreen ? 'markdown-small' : 'markdown-normal'} style={{ width: '100%' }}>
                <MarkdownRenderer>
                  {message.content}
                </MarkdownRenderer>
              </div>
            )}
          </div>
          
          {/* 消息时间 */}
          <div style={{ marginTop: '4px' }}>
            <Text type="secondary" style={{ fontSize: isSmallScreen ? '10px' : '12px', ...themeStyles.secondaryText }}>
              {new Date(message.timestamp).toLocaleString('zh-CN')}
            </Text>
          </div>
        </div>
      </div>
    </List.Item>
  );
  
  const fetchClipboardHistory = async () => {
    try {
      const result = await invoke<ClipboardItem[]>('get_clipboard_history', { 
        limit: 20,
        offset: 0,
        filterOptions: { favorite: false, pin: false }
      });
      setClipboardItems(result || []);
    } catch (error) {
      console.error('获取剪贴板历史失败:', error);
      message.error('获取剪贴板历史失败');
    }
  };

  const toggleClipboardItemSelection = (item: ClipboardItem) => {
    const isSelected = selectedClipboardItems.some(selected => selected.id === item.id);
    
    if (isSelected) {
      setSelectedClipboardItems(prev => prev.filter(selected => selected.id !== item.id));
    } else {
      setSelectedClipboardItems(prev => [...prev, item]);
    }
  };

  const confirmSelectedClipboardItems = () => {
    if (selectedClipboardItems.length === 0) {
      message.warning('请至少选择一项内容');
      return;
    }
    
    if (selectedClipboardItems.length === 1) {
      // 单选情况，保持原有逻辑
      const item = selectedClipboardItems[0];
      setClipboardRef({
        id: item.id,
        content: item.content,
        timestamp: item.timestamp,
        type: 'text'
      });
    } else {
      // 多选情况，合并内容
      const combinedContent = selectedClipboardItems
        .map((item, index) => `Content ${index + 1}: ${item.content}`)
        .join('\n\n----------------\n\n');
      
      // 使用第一个选中项的ID作为引用ID
      setClipboardRef({
        id: selectedClipboardItems[0].id,
        content: combinedContent,
        timestamp: Date.now(),
        type: 'text'
      });
      
      // 设置多选标志和详细项
      setIsMultipleItems(true);
      setDetailItems(selectedClipboardItems.map(item => ({
        id: item.id,
        content: item.content,
        timestamp: item.timestamp
      })));
    }
    
    // 关闭模态框并清空选择
    setShowClipboardModal(false);
    setSelectedClipboardItems([]);
  };

  const resetClipboardSelection = () => {
    setSelectedClipboardItems([]);
  };

  const openClipboardModal = async () => {
    // 清空之前的选择
    setSelectedClipboardItems([]);
    // 获取剪贴板历史
    await fetchClipboardHistory();
    // 显示模态框
    setShowClipboardModal(true);
  };
  
  // 处理会话重命名
  const handleRenameSession = (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) {
      message.warning('会话标题不能为空');
      return;
    }
    
    useChatStore.getState().updateSession(sessionId, { title: newTitle.trim() });
    setSessionRenameId(null);
    setRenameValue('');
    message.success('会话重命名成功');
  };
  
  // 处理会话删除
  const handleDeleteSession = (sessionId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个会话吗？此操作不可恢复。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        useChatStore.getState().deleteSession(sessionId);
        message.success('会话已删除');
      }
    });
  };
  
  // 切换会话
  const handleSelectSession = (sessionId: string) => {
    setCurrentSession(sessionId);
    setShowHistoryDrawer(false);
  };
  
  // 处理导出会话历史
  const handleExportSession = async (sessionId: string) => {
    try {
      const jsonData = await useChatStore.getState().exportSessionHistory(sessionId);
      
      // 创建Blob并下载
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // 使用会话标题作为文件名
      const session = useChatStore.getState().getSession(sessionId);
      const fileName = session ? 
        `${session.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${new Date().toISOString().split('T')[0]}.json` :
        `chat_export_${new Date().toISOString().split('T')[0]}.json`;
      
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success('会话导出成功');
    } catch (error) {
      console.error('导出会话失败:', error);
      message.error('导出会话失败');
    }
  };

  // 处理导入会话历史
  const handleImportSession = () => {
    // 创建文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    fileInput.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      
      const file = target.files[0];
      try {
        const jsonData = await file.text();
        await useChatStore.getState().importSessionHistory(jsonData);
        message.success('会话导入成功');
      } catch (error) {
        console.error('导入会话失败:', error);
        message.error('导入会话失败，请检查文件格式');
      } finally {
        document.body.removeChild(fileInput);
      }
    };
    
    fileInput.click();
  };
  
  // 在return之前添加CSS样式
  useEffect(() => {
    // 添加样式到head，处理markdown内容在小屏幕上的显示
    const styleElement = document.createElement('style');
    styleElement.innerHTML = `
      .markdown-small pre {
        max-width: 100%;
        overflow-x: auto;
        font-size: 12px;
      }
      .markdown-small code {
        font-size: 12px;
      }
      .markdown-small img {
        max-width: 100%;
        height: auto;
      }
      .markdown-small h1 {
        font-size: 18px;
      }
      .markdown-small h2 {
        font-size: 16px;
      }
      .markdown-small h3, .markdown-small h4, .markdown-small h5 {
        font-size: 14px;
      }
      .markdown-small p, .markdown-small li {
        font-size: 14px;
      }
      .markdown-small table {
        width: 100%;
        overflow-x: auto;
        display: block;
        font-size: 12px;
      }
    `;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  
  // 应用角色和模型设置
  const applyRoleModelSettings = async () => {
    if (!currentSession) return;
    
    setApplyingSettings(true);
    try {
      // 更新默认角色和提供商
      setDefaultRole(selectedRole);
      setDefaultProvider(selectedProvider);
      
      // 获取选中的角色和提供商数据
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
      useChatStore.getState().updateSession(currentSession.id, {
        aiProvider: provider,
        ...(rolePrompt && { rolePrompt }) // 仅当获取到提示词时才更新
      });
      
      message.success('设置已更新，将在下次发送消息时生效');
    } catch (error) {
      console.error('应用设置更改时出错:', error);
      message.error('更新设置失败');
    } finally {
      setApplyingSettings(false);
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
    <div className={`chat-container ${isDarkMode ? 'dark-theme' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className={`chat-header ${isDarkMode ? 'dark-theme' : ''}`} style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: isSmallScreen ? '8px 12px' : '12px 16px',
        background: 'linear-gradient(to right, #f0f2f5, #ffffff)',
        borderBottom: '1px solid #eaeaea',
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
        borderRadius: '8px 8px 0 0',
        minHeight: isSmallScreen ? '48px' : '60px',
        flexWrap: 'nowrap'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          overflow: 'hidden',
          minWidth: 0, // 确保flex子元素可以收缩到比内容更小
          maxWidth: '60%' // 限制最大宽度避免挤压右侧按钮
        }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            style={{ marginRight: '8px', flexShrink: 0 }}
            onClick={() => navigate('/')}
          />
          <div style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            minWidth: 0
          }}>
            {currentSession ? (
              <>
                <Avatar 
                  style={{ 
                    backgroundColor: '#1890ff', 
                    marginRight: '8px',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                    flexShrink: 0
                  }}
                  size={isSmallScreen ? "small" : "small"}
                  icon={<RobotOutlined />} 
                />
                <Typography.Text 
                  ellipsis={{ tooltip: currentSession.title }}
                  style={{ 
                    fontSize: isSmallScreen ? '16px' : '18px', 
                    fontWeight: 500,
                    margin: 0
                  }}
                >
                  {currentSession.title}
                </Typography.Text>
              </>
            ) : (
              <Typography.Text 
                style={{ 
                  fontSize: isSmallScreen ? '16px' : '18px', 
                  fontWeight: 500,
                  margin: 0
                }}
              >
                AI 对话
              </Typography.Text>
            )}
          </div>
          {isStreaming && (
            <Tag color="processing" style={{ marginLeft: '8px', flexShrink: 0 }}>
              <Spin size="small" />
              <span style={{ marginLeft: '5px' }}>生成中...</span>
            </Tag>
          )}
        </div>
        
        <Space size={isSmallScreen ? 'small' : 'middle'} align="center" style={{ flexShrink: 0 }}>
          {/* 添加角色和模型快速切换下拉菜单 */}
          {currentSession && (
            <Dropdown 
              menu={{
                items: [
                  {
                    key: 'role-model-selection',
                    label: '角色与模型设置',
                    type: 'group',
                    children: [
                      {
                        key: 'current-role',
                        label: (
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>当前角色</div>
                            <Tag color="blue" style={{ marginRight: 0 }}>{getSelectedRoleName()}</Tag>
                          </div>
                        ),
                        icon: <UserOutlined />,
                        onClick: () => setRoleDropdownOpen(true)
                      },
                      {
                        key: 'current-model',
                        label: (
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>当前模型</div>
                            <Tag color="green" style={{ marginRight: 0 }}>{getSelectedProviderName()}</Tag>
                          </div>
                        ),
                        icon: <RobotOutlined />,
                        onClick: () => setModelDropdownOpen(true)
                      }
                    ]
                  },
                  {
                    type: 'divider'
                  },
                  {
                    key: 'apply-changes',
                    label: '应用设置更改',
                    icon: <SwapOutlined />,
                    disabled: applyingSettings,
                    onClick: applyRoleModelSettings
                  }
                ]
              }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button 
                type="text"
                style={{ padding: isSmallScreen ? '0 8px' : undefined }}
              >
                <Space>
                  {!isSmallScreen && (
                    <>
                      <Tag color="blue">{getSelectedRoleName()}</Tag>
                      <Tag color="green">{getSelectedProviderName()}</Tag>
                    </>
                  )}
                  <SwapOutlined />
                  {!isSmallScreen && '切换'}
                </Space>
              </Button>
            </Dropdown>
          )}
          
          {/* 添加历史记录按钮 */}
          <Tooltip title="历史">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => setShowHistoryDrawer(true)}
              style={{ padding: isSmallScreen ? '0 8px' : undefined }}
            >
              {!isSmallScreen && '历史'}
            </Button>
          </Tooltip>
          
          {currentSession && (
            <Tooltip title="清空对话">
              <Button 
                type="text"
                icon={<ClearOutlined />} 
                onClick={() => {
                  useChatStore.getState().clearSession(currentSession.id);
                }}
                style={{ padding: isSmallScreen ? '0 8px' : undefined }}
              >
                {!isSmallScreen && '清空'}
              </Button>
            </Tooltip>
          )}
          
          <Dropdown
            menu={{
              items: [
                {
                  key: 'export',
                  icon: <ExportOutlined />,
                  label: '导出会话',
                  onClick: () => handleExportSession(currentSession?.id || '')
                },
                {
                  key: 'import',
                  icon: <ImportOutlined />,
                  label: '导入会话',
                  onClick: handleImportSession
                }
              ]
            }}
          >
            <Button 
              type="text"
              icon={<PlusCircleOutlined />} 
              onClick={() => setShowNewChatModal(true)}
              style={{ padding: isSmallScreen ? '0 8px' : undefined }}
              title={isSmallScreen ? "新建" : ""}
            >
              {!isSmallScreen && '新建'}
            </Button>
          </Dropdown>
        </Space>
      </div>
      
      <Divider style={{ margin: '0 0 8px 0' }} />
      
      <div className={`messages-container ${isDarkMode ? 'dark-theme' : ''}`} style={{ 
        flex: 1, 
        overflow: 'auto', 
        marginBottom: isSmallScreen ? '8px' : '16px', 
        padding: isSmallScreen ? '4px 8px' : '8px 16px' 
      }}>
        {currentSession && currentSession.messages.length > 0 ? (
          <List
            dataSource={currentSession.messages}
            renderItem={renderMessageItem}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            {loading ? (
              <>
                <Spin size="default" style={{ marginBottom: '16px' }} />
                <br />
                <Text type="secondary">
                  正在为您准备默认对话环境...
                </Text>
                <br />
                <br />
                <Text type="secondary" style={{ fontSize: '12px', opacity: 0.8 }}>
                  您可以开始输入消息，系统将在准备完成后自动发送
                </Text>
              </>
            ) : (
              <Text type="secondary">
                {currentSession ? '开始与Copy2AI助手对话吧' : '请创建或选择一个对话'}
              </Text>
            )}
          </div>
        )}
        
        {/* AI思考中提示 */}
        {isStreaming && (
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <Spin size="small" />
            <Text type="secondary" style={{ marginLeft: '10px' }}>AI正在思考...</Text>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className={`input-container ${isDarkMode ? 'dark-theme' : ''}`} style={{ 
        marginTop: 'auto', 
        padding: isSmallScreen ? '8px 12px' : '12px 16px', 
        borderTop: '1px solid #eaeaea',
        background: '#f9f9f9',
        borderRadius: '0 0 8px 8px'
      }}>
        {/* 加载状态提示 */}
        {loading && !currentSession && (
          <div style={{ 
            padding: '10px 16px', 
            marginBottom: '12px', 
            borderRadius: '8px',
            backgroundColor: 'rgba(24, 144, 255, 0.1)',
            border: '1px solid rgba(24, 144, 255, 0.2)',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Spin size="small" style={{ marginRight: '12px' }} />
            <div>
              <Text style={{ fontSize: '14px', color: isDarkMode ? '#e0e0e0' : undefined, display: 'block' }}>
                正在创建默认会话，使用默认角色和模型...
              </Text>
              <Text style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : 'rgba(0,0,0,0.45)', display: 'block', marginTop: '4px' }}>
                您可以开始输入消息，系统会在会话创建完成后自动发送
              </Text>
            </div>
          </div>
        )}
        
        {/* 引用剪贴板内容显示 */}
        {clipboardRef && (
          <Card 
            size="small" 
            style={{ 
              marginBottom: '8px',
              backgroundColor: 'rgba(24, 144, 255, 0.05)',
              borderLeft: '3px solid #1890ff',
              borderRadius: '6px'
            }}
            extra={
              <Button 
                type="text" 
                size="small" 
                danger 
                onClick={() => setClipboardRef(null)}
              >
                移除
              </Button>
            }
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <FileTextOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
              <Text type="secondary" style={{ fontSize: '12px' }}>引用的剪贴板内容</Text>
            </div>
            <Paragraph 
              ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
              style={{ marginBottom: 0, marginTop: '4px' }}
            >
              {clipboardRef.content}
            </Paragraph>
          </Card>
        )}
        
        {/* 优化输入区域布局 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          backgroundColor: isDarkMode ? '#333' : '#fff',
          borderRadius: '18px',
          padding: '4px',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
        }}>
          {/* 优化附件按钮样式 */}
          <Tooltip title="添加引用">
            <Button 
              type="text"
              icon={<PaperClipOutlined />} 
              style={{ 
                marginRight: '4px',
                borderRadius: '50%',
                width: isSmallScreen ? '32px' : '36px',
                height: isSmallScreen ? '32px' : '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                border: 'none',
                fontSize: isSmallScreen ? '14px' : '16px'
              }}
              disabled={!!clipboardRef || isStreaming || (!currentSession && !autoCreationAttempted)}
              onClick={openClipboardModal}
            />
          </Tooltip>
          
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={loading ? "正在创建会话，您可以输入消息..." : "输入消息..."}
            autoSize={{ minRows: 1, maxRows: isSmallScreen ? 4 : 6 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{ 
              flex: 1, 
              border: 'none',
              borderRadius: '16px',
              resize: 'none',
              boxShadow: 'none',
              padding: isSmallScreen ? '6px 8px' : '8px 12px',
              backgroundColor: 'transparent',
              fontSize: isSmallScreen ? '14px' : '16px'
            }}
            disabled={!currentSession && !loading}
            className={isDarkMode ? 'dark-theme' : ''}
          />
          
          {/* 优化发送按钮样式 */}
          <Tooltip title={isStreaming ? "停止生成" : "发送"}>
            <Button 
              type={isStreaming ? "default" : "primary"}
              danger={isStreaming}
              icon={isStreaming ? <StopOutlined /> : <SendOutlined />}
              onClick={handleSend}
              className="send-button"
              style={{ 
                width: isSmallScreen ? '32px' : '36px',
                height: isSmallScreen ? '32px' : '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                marginLeft: '4px',
                fontSize: isSmallScreen ? '14px' : '16px'
              }}
              disabled={!isStreaming && (!inputValue.trim() && !clipboardRef) || (!currentSession && !loading)}
            />
          </Tooltip>
        </div>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '6px',
          fontSize: isSmallScreen ? '10px' : '12px'
        }}>
          <Text type="secondary" style={{ fontSize: isSmallScreen ? '10px' : '12px' }}>
            按下Enter发送，Shift+Enter换行
          </Text>
          
          {isStreaming && (
            <Text type="secondary" style={{ fontSize: isSmallScreen ? '10px' : '12px', display: 'flex', alignItems: 'center' }}>
              <InfoCircleOutlined style={{ marginRight: '4px' }} />
              点击停止按钮可以中断当前响应
            </Text>
          )}
        </div>
      </div>
      
      {/* 修改模态框的样式以适应深色主题 */}
      <Modal
        title="新建对话"
        open={showNewChatModal}
        onOk={handleNewChat}
        onCancel={() => {
          if (sessions.length > 0) {
            setShowNewChatModal(false);
          }
        }}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ disabled: !selectedProvider || !selectedRole || loading }}
        confirmLoading={loading}
        width={800}
        className={isDarkMode ? 'dark-theme' : ''}
        footer={null}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 24, 
          paddingBottom: 16, 
          borderBottom: `1px solid ${isDarkMode ? '#333' : '#f0f0f0'}` 
        }}>
          <div>
            <Text strong style={{ color: isDarkMode ? '#e0e0e0' : undefined }}>已选择：</Text>
            {selectedRole && roles.find(r => r.id === selectedRole) && (
              <Tag color="blue">
                角色：{getSelectedRoleName()}
              </Tag>
            )}
            {selectedProvider && (
              <Tag color="green">
                模型：{getSelectedProviderName()}
              </Tag>
            )}
            <div style={{ marginTop: '4px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                创建对话后，您可以随时在顶部操作栏更改角色和模型
              </Text>
            </div>
          </div>
          <Space>
            <Button 
              onClick={() => {
                if (sessions.length > 0) {
                  setShowNewChatModal(false);
                }
              }}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              onClick={handleNewChat}
              disabled={!selectedProvider || !selectedRole || loading}
              loading={loading}
            >
              创建
            </Button>
          </Space>
        </div>

        <Tabs 
          activeKey={newChatTab} 
          onChange={setNewChatTab}
          style={{ marginBottom: 24 }}
        >
          <Tabs.TabPane tab="选择角色" key="role">
            <RoleSelectionGrid 
              onSelectRole={handleRoleChange}
              selectedRoleId={selectedRole}
            />
          </Tabs.TabPane>
          <Tabs.TabPane tab="选择模型" key="model">
            <ModelSelectionGrid
              onSelectProvider={handleProviderChange}
              selectedProviderId={selectedProvider}
            />
          </Tabs.TabPane>
        </Tabs>
      </Modal>
      
      {/* 剪贴板选择模态框 */}
      <Modal
        title="选择剪贴板引用"
        open={showClipboardModal}
        onCancel={() => {
          setShowClipboardModal(false);
          setSelectedClipboardItems([]);
        }}
        footer={null}
        styles={{ body: { paddingBottom: '60px' } }}
        className={isDarkMode ? 'dark-theme' : ''}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text style={{ color: isDarkMode ? '#e0e0e0' : undefined }}>
            点击选择剪贴板内容作为引用（可多选）
          </Text>
          {selectedClipboardItems.length > 0 && (
            <Button
              type="link"
              size="small"
              onClick={resetClipboardSelection}
              style={{ marginLeft: '8px' }}
            >
              清除所有选择
            </Button>
          )}
        </div>

        <List
          dataSource={clipboardItems}
          style={{ maxHeight: '400px', overflow: 'auto' }}
          renderItem={(item) => {
            const isSelected = selectedClipboardItems.some(selected => selected.id === item.id);
            return (
              <List.Item
                key={item.id}
                onClick={() => toggleClipboardItemSelection(item)}
                className={`clipboard-item ${isSelected ? 'selected' : ''}`}
                style={{ 
                  cursor: 'pointer', 
                  padding: '8px', 
                  borderRadius: '4px', 
                  margin: '4px 0',
                  background: isSelected ? 'rgba(24, 144, 255, 0.1)' : 'transparent',
                  border: isSelected ? '1px solid #1890ff' : '1px solid transparent'
                }}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary" style={{ 
                      fontSize: '12px',
                      color: isDarkMode ? '#aaa' : undefined
                    }}>
                      {new Date(item.timestamp).toLocaleString('zh-CN')}
                    </Text>
                    {isSelected && (
                      <Tag color="blue">已选择</Tag>
                    )}
                  </div>
                  <Paragraph 
                    ellipsis={{ rows: 2, expandable: false }}
                    style={{ 
                      marginBottom: 0,
                      color: isDarkMode ? '#e0e0e0' : undefined
                    }}
                  >
                    {item.content}
                  </Paragraph>
                </div>
              </List.Item>
            );
          }}
          locale={{ 
            emptyText: <span style={{ color: isDarkMode ? '#aaa' : undefined }}>
              没有剪贴板历史记录
            </span> 
          }}
        />

        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '10px 24px',
          borderTop: isDarkMode ? '1px solid #444' : '1px solid #f0f0f0',
          background: isDarkMode ? '#333' : '#fff',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <Button 
            onClick={() => {
              setShowClipboardModal(false);
              setSelectedClipboardItems([]);
            }}
            style={isDarkMode ? {
              backgroundColor: '#444',
              borderColor: '#555',
              color: '#e0e0e0'
            } : undefined}
          >
            取消
          </Button>
          <Button 
            type="primary" 
            onClick={confirmSelectedClipboardItems}
            disabled={selectedClipboardItems.length === 0}
            style={{ marginLeft: '8px' }}
          >
            确认选择 ({selectedClipboardItems.length} 项)
          </Button>
        </div>
      </Modal>
      
      {/* 添加多条内容详情模态框 */}
      <Modal
        title="引用内容详情"
        open={showItemDetailsModal}
        onCancel={() => setShowItemDetailsModal(false)}
        footer={[
          <Button 
            key="close" 
            onClick={() => setShowItemDetailsModal(false)}
            style={isDarkMode ? {
              backgroundColor: '#444',
              borderColor: '#555',
              color: '#e0e0e0'
            } : undefined}
          >
            关闭
          </Button>
        ]}
        width={700}
        className={isDarkMode ? 'dark-theme' : ''}
      >
        <List
          dataSource={detailItems}
          itemLayout="vertical"
          renderItem={(item, index) => (
            <List.Item
              style={{ 
                padding: '16px', 
                marginBottom: '12px', 
                border: '1px solid #e8e8e8',
                borderRadius: '8px',
                backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              className="detail-item"
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '12px',
                borderBottom: '1px solid #f0f0f0',
                paddingBottom: '8px'
              }}>
                <Typography.Text strong style={{ 
                  fontSize: '16px', 
                  color: '#1890ff'
                }}>
                  内容 {index + 1}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ 
                  fontSize: '13px',
                  color: '#aaa'
                }}>
                  {new Date(item.timestamp).toLocaleString('zh-CN')}
                </Typography.Text>
              </div>
              <Typography.Paragraph
                style={{ 
                  whiteSpace: 'pre-wrap', 
                  margin: 0, 
                  padding: '12px', 
                  backgroundColor: 'white',
                  border: '1px solid #f0f0f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}
                className="detail-item-content"
              >
                {item.content}
              </Typography.Paragraph>
            </List.Item>
          )}
        />
      </Modal>
      
      {/* 聊天历史记录抽屉 */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <HistoryOutlined style={{ marginRight: '8px' }} />
            聊天历史记录
          </div>
        }
        placement="right"
        width={300}
        onClose={() => setShowHistoryDrawer(false)}
        open={showHistoryDrawer}
        className={isDarkMode ? 'dark-theme' : ''}
        bodyStyle={{ 
          padding: '0',
          backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff',
        }}
        extra={
          <Space>
            <Tooltip title="导入会话">
              <Button 
                type="text" 
                icon={<ImportOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleImportSession();
                }}
              />
            </Tooltip>
          </Space>
        }
      >
        <div style={{ padding: '8px 16px' }}>
          <Button 
            type="primary" 
            block 
            icon={<PlusOutlined />}
            onClick={handleNewChat}
          >
            新建对话
          </Button>
        </div>
        
        <Divider style={{ margin: '8px 0' }} />
        
        {historyLoading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <Spin />
            <div style={{ marginTop: '12px' }}>加载中...</div>
          </div>
        ) : (
          <List
            dataSource={sessions}
            renderItem={session => (
              <List.Item 
                key={session.id}
                style={{ 
                  padding: '8px 16px', 
                  cursor: 'pointer',
                  backgroundColor: currentSession?.id === session.id 
                    ? (isDarkMode ? 'rgba(24, 144, 255, 0.1)' : 'rgba(24, 144, 255, 0.1)')
                    : 'transparent',
                  borderLeft: currentSession?.id === session.id 
                    ? '3px solid #1890ff' 
                    : '3px solid transparent',
                }}
                className="history-item"
                onClick={() => handleSelectSession(session.id)}
                actions={[
                  <Tooltip title="导出会话" key="export">
                    <Button 
                      type="text" 
                      icon={<ExportOutlined />} 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportSession(session.id);
                      }}
                    />
                  </Tooltip>
                ]}
              >
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    {sessionRenameId === session.id ? (
                      <Input 
                        value={renameValue} 
                        onChange={e => setRenameValue(e.target.value)}
                        onPressEnter={() => handleRenameSession(session.id, renameValue)}
                        autoFocus
                        onBlur={() => {
                          if (renameValue.trim()) {
                            handleRenameSession(session.id, renameValue);
                          } else {
                            setSessionRenameId(null);
                          }
                        }}
                        size="small"
                        style={{ width: '80%' }}
                      />
                    ) : (
                      <Tooltip title={session.title} placement="left">
                        <Text ellipsis style={{ width: '170px', color: isDarkMode ? '#e0e0e0' : undefined }}>
                          {session.title}
                        </Text>
                      </Tooltip>
                    )}
                    
                    {sessionRenameId !== session.id && (
                      <Space>
                        <Button 
                          type="text" 
                          icon={<EditOutlined />} 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionRenameId(session.id);
                            setRenameValue(session.title);
                          }}
                        />
                        <Button 
                          type="text" 
                          icon={<DeleteOutlined />} 
                          size="small"
                          danger
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                        />
                      </Space>
                    )}
                  </div>
                  
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                    {new Date(session.updatedAt).toLocaleString('zh-CN')}
                    <Tag style={{ marginLeft: '8px', fontSize: '10px' }}>
                      {session.aiProvider.name}
                    </Tag>
                    <Tag style={{ fontSize: '10px' }}>
                      {session.messages.length} 条消息
                    </Tag>
                  </Text>
                </div>
              </List.Item>
            )}
            locale={{ 
              emptyText: (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <div>暂无聊天历史</div>
                  <Space direction="vertical" style={{ marginTop: '16px' }}>
                    <Button 
                      type="primary" 
                      onClick={() => setShowNewChatModal(true)}
                    >
                      创建新对话
                    </Button>
                    <Button 
                      onClick={handleImportSession}
                      icon={<ImportOutlined />}
                    >
                      导入会话
                    </Button>
                  </Space>
                </div>
              ) 
            }}
          />
        )}
      </Drawer>
      
      {/* 添加角色选择模态框 */}
      <Modal
        title="选择对话角色"
        open={roleDropdownOpen}
        onCancel={() => setRoleDropdownOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setRoleDropdownOpen(false)}>
            取消
          </Button>,
          <Button
            key="apply"
            type="primary"
            onClick={() => {
              setRoleDropdownOpen(false);
              applyRoleModelSettings();
            }}
          >
            确认选择
          </Button>
        ]}
        width={800}
        className={isDarkMode ? 'dark-theme' : ''}
      >
        <RoleSelectionGrid 
          onSelectRole={handleRoleChange}
          selectedRoleId={selectedRole}
        />
      </Modal>
      
      {/* 添加模型选择模态框 */}
      <Modal
        title="选择AI模型"
        open={modelDropdownOpen}
        onCancel={() => setModelDropdownOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setModelDropdownOpen(false)}>
            取消
          </Button>,
          <Button
            key="apply"
            type="primary"
            onClick={() => {
              setModelDropdownOpen(false);
              applyRoleModelSettings();
            }}
          >
            确认选择
          </Button>
        ]}
        width={800}
        className={isDarkMode ? 'dark-theme' : ''}
      >
        <ModelSelectionGrid
          onSelectProvider={handleProviderChange}
          selectedProviderId={selectedProvider}
        />
      </Modal>
    </div>
  );
};

export default Chat; 