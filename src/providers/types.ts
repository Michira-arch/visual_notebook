export interface AIModel {
  id: string;
  name: string;
  providerId: string;
  tier: 'fast' | 'reasoning';
  supportsStructuredOutput: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  color: string;
  baseUrl?: string; // undefined = Gemini (uses SDK)
  models: AIModel[];
}

export type ProviderConfigs = Record<string, string>; // providerId -> apiKey

export interface ModelConfig {
  providerId: string;
  modelId: string;
}
