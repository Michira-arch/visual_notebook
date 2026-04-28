import { AIProvider } from './types';

export const PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10b981',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', providerId: 'openai', tier: 'fast', supportsStructuredOutput: true },
      { id: 'gpt-4o', name: 'GPT-4o', providerId: 'openai', tier: 'reasoning', supportsStructuredOutput: true },
      { id: 'o4-mini', name: 'o4-mini', providerId: 'openai', tier: 'reasoning', supportsStructuredOutput: false },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#3b82f6',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', providerId: 'deepseek', tier: 'fast', supportsStructuredOutput: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', providerId: 'deepseek', tier: 'reasoning', supportsStructuredOutput: false },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    color: '#f59e0b',
    models: [
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', providerId: 'gemini', tier: 'fast', supportsStructuredOutput: true },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', providerId: 'gemini', tier: 'reasoning', supportsStructuredOutput: true },
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    color: '#ec4899',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'openai/gpt-oss-20b', name: 'gpt-oss-20b', providerId: 'groq', tier: 'fast', supportsStructuredOutput: true },
      { id: 'openai/gpt-oss-120b', name: 'gpt-oss-120b', providerId: 'groq', tier: 'reasoning', supportsStructuredOutput: false },
    ],
  },
];

const LS = {
  CONFIGS: 'vnb-provider-configs',
  ACTIVE_PROVIDER: 'vnb-active-provider',
  ACTIVE_MODEL_PREFIX: 'vnb-active-model-',
  NOTEBOOK: 'vnb-notebook',
  NOTEBOOK_NAME: 'vnb-notebook-name',
};

export const STORAGE_KEY = LS.NOTEBOOK;
export const NOTEBOOK_NAME_KEY = LS.NOTEBOOK_NAME;

export function getProviderConfigs(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS.CONFIGS) || '{}'); }
  catch { return {}; }
}

export function setProviderConfigs(configs: Record<string, string>): void {
  localStorage.setItem(LS.CONFIGS, JSON.stringify(configs));
}

export function getApiKey(providerId: string): string {
  if (providerId === 'gemini') {
    const envKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || '';
    if (envKey) return envKey;
  }
  return getProviderConfigs()[providerId] || '';
}

export function getActiveProvider(): string {
  return localStorage.getItem(LS.ACTIVE_PROVIDER) || 'gemini';
}

export function setActiveProvider(providerId: string): void {
  localStorage.setItem(LS.ACTIVE_PROVIDER, providerId);
}

export function getActiveModel(providerId: string): string {
  const stored = localStorage.getItem(`${LS.ACTIVE_MODEL_PREFIX}${providerId}`);
  if (stored) return stored;
  return PROVIDERS.find(p => p.id === providerId)?.models[0]?.id || '';
}

export function setActiveModel(providerId: string, modelId: string): void {
  localStorage.setItem(`${LS.ACTIVE_MODEL_PREFIX}${providerId}`, modelId);
}
