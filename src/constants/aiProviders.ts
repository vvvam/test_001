import { AIProvider } from '../models/ai';

// AI_PROVIDERS常量定义
export const AI_PROVIDERS: Record<string, AIProvider> = {
 
};

export const DEFAULT_PROVIDER_ID = 'Copy2AI';

// 温度值范围
export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 2;
export const TEMPERATURE_DEFAULT = 0.7;
export const TEMPERATURE_STEP = 0.1;

// 最大令牌数范围
export const MAX_TOKENS_MIN = 16;
export const MAX_TOKENS_MAX = 32768;
export const MAX_TOKENS_DEFAULT = 2048;
export const MAX_TOKENS_STEP = 16;

// 预定义的AI服务提供商
export const DEFAULT_AI_PROVIDERS: AIProvider[] = [

  {
    id: 'Copy2AI',
    name: '默认AI模型',
    apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: ['GLM-4-Flash-250414'],
    supportsModelsList: true,
    modelsListUrl: '#',
    requiresApiKey: true,
    description: 'Copy2AI默认模型，无需配置即可使用，由智普AI强力驱动。',
    website: 'https://open.bigmodel.cn'
  },
  {
    id: 'ollama',
    name: 'Ollama',
    apiBaseUrl: 'http://localhost:11434/v1',
    defaultModels: ['llama3'],
    supportsModelsList: true,
    modelsListUrl: 'http://localhost:11434/v1/models',
    requiresApiKey: false,
    description: '本地运行的 Ollama 模型服务，遇到“fetch error”需要开启跨域支持，简单修改环境变量即可。',
    website: 'https://ollama.com'
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot AI)',
    apiBaseUrl: 'https://api.moonshot.cn/v1',
    defaultModels: ['moonshot-v1-32k', 'moonshot-v1-8k', 'moonshot-v1-128k'],
    supportsModelsList: true,
    modelsListUrl: 'https://api.moonshot.cn/v1/models',
    requiresApiKey: true,
    description: 'Moonshot AI 提供的 Kimi 大模型 API',
    website: 'https://moonshot.cn'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    supportsModelsList: true,
    modelsListUrl: 'https://api.deepseek.com/v1/models',
    requiresApiKey: true,
    description: 'DeepSeek AI 提供的大模型 API',
    website: 'https://deepseek.com'
  },
  {
    id: 'qwen',
    name: '通义千问',
    apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModels: ['qwq-32b','qwen-turbo','qwen-plus','qwen-max','qwen-long','qwen-omni-turbo','qvq-max','qwq-32b-preview','qwen2.5-14b-instruct-1m','qwen2.5-7b-instruct-1m','qwen2.5-72b-instruct','qwen2.5-32b-instruct','qwen2.5-14b-instruct','qwen2.5-7b-instruct','qwen2.5-3b-instruct'],
    supportsModelsList: false,
    modelsListUrl: '',
    requiresApiKey: true,
    description: '阿里云提供的通义千问大模型 API',
    website: 'https://bailian.console.aliyun.com/'
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModels: ["GLM-4-Plus","GLM-4-Air-250414","GLM-4-Long","GLM-4-AirX","GLM-4-FlashX","GLM-4-Flash-250414"],
    supportsModelsList: true,
    modelsListUrl: 'https://open.bigmodel.cn/api/paas/v4/models',
    requiresApiKey: true,
    description: '智谱 AI 提供的 ChatGLM 系列模型 API',
    website: 'https://zhipuai.cn'
  },
  {
    id: 'baichuan',
    name: '百川智能',
    apiBaseUrl: 'https://api.baichuan-ai.com/v1',
    defaultModels: ["Baichuan4-Turbo","Baichuan4-Air","Baichuan4","Baichuan3-Turbo","Baichuan3-Turbo-128k","Baichuan2-Turbo"],
    supportsModelsList: true,
    modelsListUrl: 'https://api.baichuan-ai.com/v1/models',
    requiresApiKey: true,
    description: '百川智能提供的大模型 API',
    website: 'https://www.baichuan-ai.com'
  },
  {
    id: '302ai',
    name: '302 AI',
    apiBaseUrl: 'https://api.302ai.cn/v1',
    defaultModels: ['302-chat'],
    supportsModelsList: true,
    modelsListUrl: 'https://api.302ai.cn/v1/models',
    requiresApiKey: true,
    description: '302 AI 提供的大模型 API'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    defaultModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o'],
    supportsModelsList: true,
    modelsListUrl: 'https://api.openai.com/v1/models',
    requiresApiKey: true,
    description: 'OpenAI 提供的 GPT 系列模型 API',
    website: 'https://openai.com'
  },
  {
    id: 'ollama-legacy',
    name: 'Ollama (经典API)',
    apiBaseUrl: 'http://localhost:11434/api',
    defaultModels: ['llama3', 'mistral', 'codellama', 'gemma'],
    supportsModelsList: true,
    modelsListUrl: 'http://localhost:11434/api/tags',
    requiresApiKey: false,
    description: '本地运行的 Ollama 模型服务（经典API）',
    website: 'https://ollama.ai'
  },
  {
    id: 'vllm',
    name: 'vLLM',
    apiBaseUrl: 'http://localhost:8000/v1',
    defaultModels: ['llama-2-7b'],
    supportsModelsList: false,
    requiresApiKey: false,
    description: '基于 vLLM 的本地模型服务',
    website: 'https://github.com/vllm-project/vllm'
  },
  {
    id: 'localai',
    name: 'LocalAI',
    apiBaseUrl: 'http://localhost:8080/v1',
    defaultModels: ['ggml-model'],
    supportsModelsList: true,
    modelsListUrl: 'http://localhost:8080/v1/models',
    requiresApiKey: false,
    description: 'LocalAI 提供的本地模型服务',
    website: 'https://localai.io'
  },
  {
    id: 'LMStudio',
    name: 'LMStudio',
    apiBaseUrl: 'http://localhost:8080/v1',
    defaultModels: ['test'],
    supportsModelsList: true,
    modelsListUrl: 'http://localhost:8080/v1/models',
    requiresApiKey: false,
    description: 'LM Studio 提供的本地模型服务',
    website: 'https://lmstudio.ai/'
  },
  {
    id: 'custom',
    name: '自定义',
    apiBaseUrl: '',
    defaultModels: ['custom-model'],
    supportsModelsList: false,
    requiresApiKey: true,
    description: '自定义的 OpenAI 兼容 API,适用市面上大部分AI服务提供商'
  }
]; 