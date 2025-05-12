import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { invoke } from '@tauri-apps/api/core';
import { message } from 'antd';
import { ChatSession, Message, StreamResponse, ClipboardReference } from '../models/chat';
import { AIProvider, AIProviderSettings } from '../models/ai';
import { useAISettingsStore } from './aiSettingsStore';
import { persist } from 'zustand/middleware';

// 在store外部管理处理状态，避免Zustand状态更新问题
let processingMessageCount = 0;
let messageSequence = 0;

// 最大会话历史存储数量
const MAX_SESSIONS_HISTORY = 100;

interface ChatState {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  isStreaming: boolean;
  streamAbortController: AbortController | null;
  
  // 会话管理
  createSession: (aiProvider: AIProvider, systemPrompt?: string, rolePrompt?: string) => ChatSession;
  setCurrentSession: (sessionId: string) => void;
  getSession: (sessionId: string) => ChatSession | undefined;
  deleteSession: (sessionId: string) => void;
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  
  // 消息管理
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>, sessionId?: string) => string;
  updateMessage: (messageId: string, content: string, sessionId?: string) => void;
  deleteMessage: (messageId: string, sessionId?: string) => void;
  clearSession: (sessionId: string) => void;
  
  // 流式对话相关
  startStreaming: () => AbortController;
  stopStreaming: () => void;
  appendStreamContent: (response: StreamResponse) => void;
  
  // AI对话核心功能
  sendMessage: (content: string, clipboardRef?: ClipboardReference) => Promise<void>;
  
  // 导入/导出会话历史
  exportSessionHistory: (sessionId: string) => Promise<string>;
  importSessionHistory: (jsonData: string) => Promise<void>;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSession: null,
      isStreaming: false,
      streamAbortController: null,
      
      // 创建新会话
      createSession: (aiProvider, systemPrompt, rolePrompt) => {
        const newSession: ChatSession = {
          id: uuidv4(),
          title: `新对话 ${new Date().toLocaleString('zh-CN', { 
            month: 'numeric', 
            day: 'numeric',
            hour: 'numeric', 
            minute: 'numeric'
          })}`,
          messages: [],
          aiProvider,
          systemPrompt,
          rolePrompt,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        set(state => {
          // 按更新时间排序，确保最新的会话在前面
          const sortedSessions = [...state.sessions, newSession]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            // 保留最大数量的会话
            .slice(0, MAX_SESSIONS_HISTORY);
            
          return {
            sessions: sortedSessions,
            currentSession: newSession
          };
        });
        
        return newSession;
      },
      
      // 设置当前会话
      setCurrentSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) {
          set({ currentSession: session });
        }
      },
      
      // 获取指定会话
      getSession: (sessionId) => {
        return get().sessions.find(s => s.id === sessionId);
      },
      
      // 删除会话
      deleteSession: (sessionId) => {
        set(state => {
          const newSessions = state.sessions.filter(s => s.id !== sessionId);
          const currentSession = state.currentSession?.id === sessionId 
            ? (newSessions.length > 0 ? newSessions[0] : null)
            : state.currentSession;
            
          return { sessions: newSessions, currentSession };
        });
      },
      
      // 更新会话属性
      updateSession: (sessionId, updates) => {
        set(state => {
          const updatedSessions = state.sessions.map(session => {
            if (session.id === sessionId) {
              return {
                ...session,
                ...updates,
                updatedAt: Date.now()
              };
            }
            return session;
          });
          
          // 更新后按更新时间重新排序
          const sortedSessions = [...updatedSessions]
            .sort((a, b) => b.updatedAt - a.updatedAt);
          
          const updatedCurrentSession = state.currentSession?.id === sessionId
            ? sortedSessions.find(s => s.id === sessionId) || state.currentSession
            : state.currentSession;
            
          return { 
            sessions: sortedSessions,
            currentSession: updatedCurrentSession
          };
        });
      },
      
      // 添加消息
      addMessage: (messageData, sessionId) => {
        const targetSessionId = sessionId || get().currentSession?.id;
        if (!targetSessionId) {
          throw new Error('未指定会话ID且没有当前活跃会话');
        }
        
        const messageId = uuidv4();
        const message: Message = {
          id: messageId,
          ...messageData,
          timestamp: Date.now()
        };
        
        set(state => {
          const updatedSessions = state.sessions.map(session => {
            if (session.id === targetSessionId) {
              return {
                ...session,
                messages: [...session.messages, message],
                updatedAt: Date.now()
              };
            }
            return session;
          });
          
          // 更新后按更新时间重新排序
          const sortedSessions = [...updatedSessions]
            .sort((a, b) => b.updatedAt - a.updatedAt);
          
          const updatedCurrentSession = state.currentSession?.id === targetSessionId
            ? sortedSessions.find(s => s.id === targetSessionId) || state.currentSession
            : state.currentSession;
            
          return { 
            sessions: sortedSessions,
            currentSession: updatedCurrentSession
          };
        });
        
        return messageId;
      },
      
      // 更新消息
      updateMessage: (messageId, content, sessionId) => {
        const targetSessionId = sessionId || get().currentSession?.id;
        if (!targetSessionId) return;
        
        set(state => {
          const updatedSessions = state.sessions.map(session => {
            if (session.id === targetSessionId) {
              const updatedMessages = session.messages.map(msg => {
                if (msg.id === messageId) {
                  return { ...msg, content };
                }
                return msg;
              });
              
              return {
                ...session,
                messages: updatedMessages,
                updatedAt: Date.now()
              };
            }
            return session;
          });
          
          const updatedCurrentSession = state.currentSession?.id === targetSessionId
            ? updatedSessions.find(s => s.id === targetSessionId) || state.currentSession
            : state.currentSession;
            
          return { 
            sessions: updatedSessions,
            currentSession: updatedCurrentSession
          };
        });
      },
      
      // 删除消息
      deleteMessage: (messageId, sessionId) => {
        const targetSessionId = sessionId || get().currentSession?.id;
        if (!targetSessionId) return;
        
        set(state => {
          const updatedSessions = state.sessions.map(session => {
            if (session.id === targetSessionId) {
              return {
                ...session,
                messages: session.messages.filter(msg => msg.id !== messageId),
                updatedAt: Date.now()
              };
            }
            return session;
          });
          
          const updatedCurrentSession = state.currentSession?.id === targetSessionId
            ? updatedSessions.find(s => s.id === targetSessionId) || state.currentSession
            : state.currentSession;
            
          return { 
            sessions: updatedSessions,
            currentSession: updatedCurrentSession
          };
        });
      },
      
      // 清空会话消息
      clearSession: (sessionId) => {
        set(state => {
          const updatedSessions = state.sessions.map(session => {
            if (session.id === sessionId) {
              return {
                ...session,
                messages: [],
                updatedAt: Date.now()
              };
            }
            return session;
          });
          
          const updatedCurrentSession = state.currentSession?.id === sessionId
            ? updatedSessions.find(s => s.id === sessionId) || state.currentSession
            : state.currentSession;
            
          return { 
            sessions: updatedSessions,
            currentSession: updatedCurrentSession
          };
        });
      },
      
      // 开始流式响应
      startStreaming: () => {
        const controller = new AbortController();
        set({ isStreaming: true, streamAbortController: controller });
        return controller;
      },
      
      // 停止流式响应
      stopStreaming: () => {
        const { streamAbortController } = get();
        if (streamAbortController) {
          streamAbortController.abort();
        }
        set({ isStreaming: false, streamAbortController: null });
      },
      
      // 追加流式内容
      appendStreamContent: (response) => {
        const { currentSession } = get();
        if (!currentSession) return;
        
        const lastMessage = currentSession.messages[currentSession.messages.length - 1];
        if (!lastMessage || lastMessage.role !== 'assistant') return;
        
        const delta = response.choices[0]?.delta.content || '';

        set(state => {
          const updatedSessions = state.sessions.map(session => {
            if (session.id === currentSession.id) {
              const updatedMessages = session.messages.map((msg, index) => {
                if (index === session.messages.length - 1) {
                  return { ...msg, content: msg.content + delta };
                }
                return msg;
              });
              
              return {
                ...session,
                messages: updatedMessages
              };
            }
            return session;
          });
          
          const updatedCurrentSession = updatedSessions.find(s => s.id === currentSession.id) 
            || state.currentSession;
            
          return { 
            sessions: updatedSessions,
            currentSession: updatedCurrentSession
          };
        });
      },
      
      // 发送消息并获取AI响应
      sendMessage: async (content, clipboardRef) => {
        // 如果有消息正在处理中，则加入等待队列
        if (processingMessageCount > 0) {
          message.info('有消息正在处理中，请稍等...');
          
          // 随机延迟500-1500ms后重试，避免不必要的并发冲突
          const delay = 500 + Math.floor(Math.random() * 1000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // 延迟后再次检查，如果还在处理中，则排队等待
          if (processingMessageCount > 0) {
            const currentSequence = ++messageSequence;
            console.log(`消息 #${currentSequence} 排队等待中...`);
            
            // 等待直到没有消息在处理
            while (processingMessageCount > 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log(`消息 #${currentSequence} 开始处理`);
          }
        }
        
        // 标记开始处理新消息
        processingMessageCount++;
        const mySequence = ++messageSequence;
        console.log(`开始处理消息 #${mySequence}`);
        
        const { currentSession, addMessage, startStreaming, stopStreaming, appendStreamContent, updateMessage } = get();
        
        if (!currentSession) {
          processingMessageCount--; // 减少计数
          message.error('请先创建或选择一个对话');
          return;
        }
        
        // 强制重置流式状态，确保清洁开始
        if (get().isStreaming) {
          console.log(`消息 #${mySequence} 检测到流式状态未清除，强制重置`);
          stopStreaming();
          // 给状态更新一些时间
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // 重要：创建一个当前会话消息的完整副本，避免依赖zustand状态更新
        const currentMessages = [...currentSession.messages];
        
        // 创建用户消息对象
        const userMessage = {
          id: uuidv4(),
          role: 'user' as const,
          content,
          clipboardRef,
          timestamp: Date.now()
        };
        
        // 添加用户消息到界面
        addMessage({
          role: 'user',
          content,
          clipboardRef
        });
        
        // 将新消息直接添加到我们的本地副本中
        currentMessages.push(userMessage);
        
        // 创建助手消息占位
        const assistantMessageId = addMessage({
          role: 'assistant',
          content: ''
        });
        
        // 记录助手消息对象，但不添加到消息历史用于API请求
        const assistantMessage = {
          id: assistantMessageId,
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now()
        };
        
        try {
          // 获取AI设置
          const aiSettings = useAISettingsStore.getState();
          const providerId = currentSession.aiProvider.id;
          const providerSettings = aiSettings.settings.providers[providerId];
          
          if (!providerSettings) {
            throw new Error(`未找到提供商设置: ${providerId}`);
          }
          
          // 构建消息历史 - 使用我们的本地副本
          const messages = [
            ...(currentSession.systemPrompt ? [{
              role: 'system' as const,
              content: currentSession.systemPrompt
            }] : []),
            ...(currentSession.rolePrompt ? [{
              role: 'system' as const,
              content: currentSession.rolePrompt
            }] : []),
            // 使用本地副本，不依赖zustand状态
            ...currentMessages.map(msg => {
              // 如果消息有剪贴板引用，将引用内容添加到消息中
              if (msg.clipboardRef && msg.clipboardRef.content) {
                return {
                  role: msg.role,
                  content: `${msg.content}\n\n${msg.clipboardRef.content}`
                };
              }
              return {
                role: msg.role,
                content: msg.content
              };
            })
          ];
          
    
          // 是否使用流式响应
          if (providerSettings.use_stream) {
            const controller = startStreaming();

            try {
              const response = await fetch(`${currentSession.aiProvider.apiBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${providerSettings.api_key || ''}`
                },
                body: JSON.stringify({
                  model: providerSettings.selected_model,
                  messages,
                  temperature: providerSettings.temperature,
                  max_tokens: providerSettings.max_tokens,
                  stream: true
                }),
                signal: controller.signal
              });
              
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new Error(`API错误: ${errorData.error?.message || response.statusText}`);
              }
              
              const reader = response.body?.getReader();
              if (!reader) throw new Error('无法创建流式读取器');
              
              const decoder = new TextDecoder();
              let buffer = '';
              
              // 记录完整响应内容，用于调试
              let fullResponseContent = '';
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                  const trimmedLine = line.trim();
                  if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
                  
                  try {
                    const data = JSON.parse(trimmedLine.replace(/^data: /, ''));
                    const content = data.choices[0]?.delta.content || '';
                    
                    // 收集完整响应并检查思考标签
                    fullResponseContent += content;
                    
                    appendStreamContent(data);
                  } catch (e) {
                    console.error('解析流响应失败:', e, trimmedLine);
                  }
                }
              }
              
              // 响应完成后，检查完整内容
              console.log(`消息 #${mySequence} 流式请求完成`);
              
            } catch (error: any) {
              if (error.name !== 'AbortError') {
                throw error;
              }
            } finally {
              stopStreaming();
              // 确保状态完全更新
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } else {
            console.log(`消息 #${mySequence} 开始非流式请求`);
            try {
              const response = await fetch(`${currentSession.aiProvider.apiBaseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${providerSettings.api_key || ''}`
                },
                body: JSON.stringify({
                  model: providerSettings.selected_model,
                  messages,
                  temperature: providerSettings.temperature,
                  max_tokens: providerSettings.max_tokens,
                  stream: false
                })
              });
              
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
                throw new Error(`API错误: ${errorData.error?.message || response.statusText}`);
              }
              
              const data = await response.json();
              const responseContent = data.choices[0]?.message?.content || '';
              
              updateMessage(assistantMessageId, responseContent);
              console.log(`消息 #${mySequence} 非流式请求完成`);
            } catch (error: any) {
              throw error;
            }
          }
        } catch (error: any) {
          console.error(`消息 #${mySequence} 处理失败:`, error);
          message.error(`获取AI响应失败: ${error.message}`);
          updateMessage(assistantMessageId, `错误: ${error.message}`);
        } finally {
          // 不管成功还是失败，最后都要减少消息处理计数
          processingMessageCount--;
          console.log(`消息 #${mySequence} 处理完成，当前处理中消息数: ${processingMessageCount}`);
        }
      },
      
      // 导出会话历史为JSON
      exportSessionHistory: async (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (!session) {
          throw new Error('未找到指定会话');
        }
        
        return JSON.stringify(session);
      },
      
      // 导入会话历史
      importSessionHistory: async (jsonData) => {
        try {
          const session = JSON.parse(jsonData) as ChatSession;
          
          // 验证必要的字段
          if (!session.id || !session.title || !Array.isArray(session.messages) || !session.aiProvider) {
            throw new Error('会话数据无效');
          }
          
          // 检查是否已存在相同ID的会话
          const existingSession = get().sessions.find(s => s.id === session.id);
          if (existingSession) {
            // 如果已存在，使用新ID
            session.id = uuidv4();
          }
          
          // 设置时间戳
          session.createdAt = session.createdAt || Date.now();
          session.updatedAt = Date.now();
          
          set(state => {
            // 添加会话并排序
            const sortedSessions = [...state.sessions, session]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, MAX_SESSIONS_HISTORY);
              
            return { 
              sessions: sortedSessions,
              currentSession: session 
            };
          });
          
          message.success('会话导入成功');
        } catch (error) {
          console.error('导入会话失败:', error);
          throw new Error(`导入会话失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    }),
    {
      name: 'copy2ai-chat-store',  // 存储的键名
      // 可选地配置持久化哪些字段
      partialize: (state) => ({
        sessions: state.sessions,
        currentSession: state.currentSession,
        // 不存储流式状态和控制器
      }),
    }
  )
);