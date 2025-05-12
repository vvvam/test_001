/**
 * API 客户端模块，封装了与后端的通信逻辑
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// 定义简化版的 ChatMessage 接口，与 Rust 后端接口匹配
interface ChatMessage {
  role: string;
  content: string;
}

/**
 * 请求流式聊天响应
 * @param url API基础URL
 * @param apiKey API密钥
 * @param model 模型名称
 * @param messages 消息列表
 * @param temperature 温度参数
 * @param maxTokens 最大令牌数
 * @param onData 数据回调函数
 */
export async function streamChat(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  onData: (data: any) => void
): Promise<void> {
  // 注册监听器接收流式响应
  const unlisten = await listen('stream-response', (event) => {
    onData(event.payload);
  });

  try {
    // 调用后端命令发送请求
    await invoke('stream_chat', {
      request: {
        url,
        api_key: apiKey,
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      }
    });
  } finally {
    // 不管是成功还是失败，都需要取消监听
    unlisten();
  }
}

/**
 * 请求非流式聊天响应
 * @param url API基础URL
 * @param apiKey API密钥
 * @param model 模型名称
 * @param messages 消息列表
 * @param temperature 温度参数
 * @param maxTokens 最大令牌数
 */
export async function chatCompletion(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<any> {
  // 使用Rust后端命令发送请求，完全避免跨域问题
  return invoke('chat_completion', {
    request: {
      url,
      api_key: apiKey,
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    }
  });
}

/**
 * 取消流式请求
 * @param streamId 流ID
 */
export async function cancelStream(streamId: string): Promise<void> {
  await invoke('cancel_stream', { stream_id: streamId });
}