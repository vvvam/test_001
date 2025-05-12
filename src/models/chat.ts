import { AIProvider } from './ai';

export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  clipboardRef?: ClipboardReference;
}

export interface ClipboardReference {
  id: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'file';
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  aiProvider: AIProvider;
  systemPrompt?: string;
  rolePrompt?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StreamResponse {
  id: string;
  choices: {
    delta: {
      content?: string;
      role?: string;
    };
    index: number;
    finish_reason: string | null;
  }[];
  created: number;
} 