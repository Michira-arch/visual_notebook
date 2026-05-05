import { GoogleGenAI, Type } from '@google/genai';
import { PROVIDERS, getApiKey } from './registry';
import { ModelConfig } from './types';

export interface GenerateParams extends ModelConfig {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  images?: string[]; // base64 strings
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function generateText(params: GenerateParams): Promise<string> {
  const { providerId, modelId, systemPrompt, userPrompt, temperature = 0.4, images = [] } = params;
  const apiKey = getApiKey(providerId);
  if (!apiKey) throw new Error(`No API key configured for provider: ${providerId}`);

  if (providerId === 'gemini') {
    return geminiText({ apiKey, modelId, systemPrompt, userPrompt, temperature, images });
  }
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider?.baseUrl) throw new Error(`Unknown provider: ${providerId}`);
  return openaiCompatText({ baseUrl: provider.baseUrl, apiKey, modelId, systemPrompt, userPrompt, temperature, images });
}

export interface FloodlightItem {
  type: 'markdown' | 'canvas';
  content: string;
}

export async function generateFloodlightPlan(params: GenerateParams): Promise<FloodlightItem[]> {
  const { providerId, modelId, systemPrompt, userPrompt, temperature = 0.6 } = params;
  const apiKey = getApiKey(providerId);
  if (!apiKey) throw new Error(`No API key configured for provider: ${providerId}`);

  if (providerId === 'gemini') {
    return geminiFloodlight({ apiKey, modelId, systemPrompt, userPrompt, temperature });
  }
  const provider = PROVIDERS.find(p => p.id === providerId);
  if (!provider?.baseUrl) throw new Error(`Unknown provider: ${providerId}`);
  const text = await openaiCompatText({
    baseUrl: provider.baseUrl, apiKey, modelId, systemPrompt,
    userPrompt: userPrompt + '\n\nRespond ONLY with a valid JSON object: {"cells":[{"type":"markdown"|"canvas","content":"..."}]}',
    temperature, jsonMode: true,
  });
  try {
    const parsed = JSON.parse(text);
    const items: FloodlightItem[] = Array.isArray(parsed) ? parsed : (parsed.cells || []);
    return items.filter(i => i.type === 'markdown' || i.type === 'canvas');
  } catch {
    throw new Error('Failed to parse Floodlight plan response as JSON');
  }
}

// ─── Gemini ────────────────────────────────────────────────────────────────

interface GeminiOpts {
  apiKey: string; modelId: string; systemPrompt: string; userPrompt: string; temperature: number;
  images?: string[];
}

async function geminiText(o: GeminiOpts): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: o.apiKey });
  const parts: any[] = [{ text: o.userPrompt }];
  if (o.images) {
    o.images.forEach(img => {
      const base64Data = img.includes('base64,') ? img.split('base64,')[1] : img;
      parts.push({ inlineData: { data: base64Data, mimeType: 'image/png' } });
    });
  }
  const res = await ai.models.generateContent({
    model: o.modelId, contents: [{ role: 'user', parts }],
    config: { systemInstruction: o.systemPrompt, temperature: o.temperature },
  });
  return res.text || '';
}

async function geminiFloodlight(o: GeminiOpts): Promise<FloodlightItem[]> {
  const ai = new GoogleGenAI({ apiKey: o.apiKey });
  const res = await ai.models.generateContent({
    model: o.modelId, contents: o.userPrompt,
    config: {
      systemInstruction: o.systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ['type', 'content'],
        },
      },
      temperature: o.temperature,
    },
  });
  const items: FloodlightItem[] = JSON.parse(res.text || '[]');
  return items.filter(i => i.type === 'markdown' || i.type === 'canvas');
}

// ─── OpenAI-compatible ─────────────────────────────────────────────────────

interface OAIOpts {
  baseUrl: string; apiKey: string; modelId: string;
  systemPrompt: string; userPrompt: string; temperature: number;
  jsonMode?: boolean;
  images?: string[];
}

async function openaiCompatText(o: OAIOpts): Promise<string> {
  const userContent: any[] = [{ type: 'text', text: o.userPrompt }];
  if (o.images) {
    o.images.forEach(img => {
      const url = img.startsWith('data:') ? img : `data:image/png;base64,${img}`;
      userContent.push({ type: 'image_url', image_url: { url } });
    });
  }

  const body: Record<string, unknown> = {
    model: o.modelId,
    messages: [
      { role: 'system', content: o.systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: o.temperature,
  };
  if (o.jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(`${o.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${o.apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error (${res.status}): ${err}`);
  }
  const data = await res.json();
  const message = data.choices?.[0]?.message;
  
  let text = message?.content || '';
  
  // If the API returns reasoning_content, we can format it nicely using markdown quotes if it's not a JSON response.
  if (message?.reasoning_content && !o.jsonMode) {
    const reasoningText = message.reasoning_content.trim().split('\n').map((l: string) => `> ${l}`).join('\n');
    text = `> **AI Reasoning:**\n${reasoningText}\n\n---\n\n${text}`;
  }
  
  return text;
}
