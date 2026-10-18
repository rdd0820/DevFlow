import { createAlibaba } from '@ai-sdk/alibaba';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

/** 测试连接只要求模型吐出几个字，避免一次探测消耗过多 token。 */
const PROBE_MAX_OUTPUT_TOKENS = 16;
/** 测试连接的超时。到点 abort，原错误交给调用方。 */
const PROBE_TIMEOUT_MS = 20_000;

/** 未写 LLM_BASE_URL 时使用的官方地址。 */
const DEFAULT_BASE_URL = 'https://api.deepseek.com';
/** 未写 LLM_MODEL 时使用的模型名。 */
const DEFAULT_MODEL_ID = 'deepseek-v4-pro';

/**
 * 创建语言模型时走哪家 SDK。
 * openai-compatible 用于自建网关，以及接口兼容 OpenAI 但没有专用适配的地址。
 */
export type ProviderSdk =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'alibaba'
  | 'openai-compatible';

/**
 * 与各厂商适配器实例化后返回的语言模型一致。
 * 后续包裹模型时要用这个具体类型，而不是还包含字符串的 LanguageModel。
 */
export type SdkLanguageModelV3 = ReturnType<ReturnType<typeof createOpenAI>>;

/**
 * 当前主模型的厂商和模型名。不创建 SDK 实例，上下文预算可以只拿这份标识。
 */
export type MainModelIdentity = {
  /** 用哪家工厂创建 */
  sdk: ProviderSdk;
  /** 请求里的模型名 */
  model: string;
};

/**
 * 发给厂商适配器的固定选项。
 * 关闭深度思考和并行工具调用，避免一次普通对话走偏到长思考。
 */
export const providerOptions = {
  alibaba: { enableThinking: false, parallelToolCalls: false },
  deepseek: { thinking: { type: 'disabled' as const } },
};

/**
 * 按厂商和模型名现建一个语言模型。每次调用都读环境变量，改配置后下一次请求即生效。
 * 没有密钥或没有地址时抛错。
 *
 * @param sdk 用哪家工厂
 * @param modelId 请求里的模型名
 */
export function getLanguageModel(sdk: ProviderSdk, modelId: string): SdkLanguageModelV3 {
  const apiKey = process.env.LLM_API_KEY?.trim() ?? '';
  const baseURL = process.env.LLM_BASE_URL?.trim() || DEFAULT_BASE_URL;
  if (!apiKey) {
    throw new Error('未配置模型密钥');
  }
  if (!baseURL) {
    throw new Error('未配置模型地址');
  }
  return createBySdk(sdk, sdk, apiKey, baseURL, modelId);
}

/**
 * 当前主模型。厂商或模型名无法确定时抛错。
 */
export function getMainModel(): SdkLanguageModelV3 {
  const { sdk, model } = getMainModelIdentity();
  return getLanguageModel(sdk, model);
}

/**
 * 当前主模型的厂商和模型名。不创建 SDK 实例。
 * 写了 LLM_SDK 时用该值；否则按 LLM_BASE_URL 的主机名判断，识别不了就按 OpenAI 兼容接口。
 */
export function getMainModelIdentity(): MainModelIdentity {
  const baseURL = process.env.LLM_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL_ID;
  const configured = process.env.LLM_SDK?.trim();
  const sdk = configured ? parseSdk(configured) : sdkFromBaseURL(baseURL);
  return { sdk, model };
}

/**
 * 用调用方给的密钥、地址和模型发一次极短对话，验证这条配置能连上。
 * 不读环境变量。成功返回耗时毫秒数；厂商拒绝或超时时把原错误抛出。
 *
 * @param sdk 用哪家工厂。自建网关传 openai-compatible
 * @param apiKey 明文密钥。openai-compatible 允许空串，请求里就不带 Authorization
 * @param baseURL 实际请求的地址
 * @param modelId 用来试对话的模型名
 * @returns 从发出请求到拿到结果的毫秒数
 */
export async function probeLanguageModel(
  sdk: ProviderSdk,
  apiKey: string,
  baseURL: string,
  modelId: string,
): Promise<number> {
  const model = createBySdk(sdk, sdk, apiKey, baseURL, modelId);
  const started = Date.now();
  await generateText({
    model,
    prompt: '你好',
    maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    providerOptions,
  });
  return Date.now() - started;
}

/**
 * 按 sdk 选工厂。
 * providerId 只用作 openai-compatible 的提供方名称。
 * 测试连接也走这里，保证探测和运行时用同一条创建链路。
 */
export function createBySdk(
  sdk: ProviderSdk,
  providerId: string,
  apiKey: string,
  baseURL: string,
  modelId: string,
): SdkLanguageModelV3 {
  switch (sdk) {
    case 'openai':
      return createOpenAI({ apiKey, baseURL })(modelId);
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL })(modelId);
    case 'google':
      return createGoogleGenerativeAI({ apiKey, baseURL })(modelId);
    case 'deepseek':
      return createDeepSeek({ apiKey, baseURL })(modelId);
    case 'alibaba':
      return createAlibaba({ apiKey, baseURL })(modelId);
    case 'openai-compatible': {
      // 密钥为空时不传 apiKey，请求里就不会带 Authorization。部分自建网关不需要鉴权。
      const key = apiKey.trim();
      return createOpenAICompatible({
        name: providerId,
        baseURL,
        ...(key ? { apiKey: key } : {}),
      })(modelId);
    }
    default: {
      const unsupported: never = sdk;
      throw new Error(`不支持的模型类型: ${String(unsupported)}`);
    }
  }
}

/**
 * 把环境变量里的厂商名解析成工厂标识。
 * 无法识别时抛错，避免静默落到另一家接口。
 */
function parseSdk(value: string): ProviderSdk {
  switch (value) {
    case 'openai':
    case 'anthropic':
    case 'google':
    case 'deepseek':
    case 'alibaba':
    case 'openai-compatible':
      return value;
    default:
      throw new Error(`不支持的模型类型: ${value}`);
  }
}

/**
 * 按接口地址的主机名选择工厂。
 * 地址不是合法 URL，或主机名不属于已知厂商时，按 OpenAI 兼容接口处理。
 */
function sdkFromBaseURL(baseURL: string): ProviderSdk {
  let host = '';
  try {
    host = new URL(baseURL).hostname;
  } catch {
    return 'openai-compatible';
  }
  if (host === 'api.deepseek.com' || host.endsWith('.deepseek.com')) return 'deepseek';
  if (host === 'api.openai.com' || host.endsWith('.openai.com')) return 'openai';
  if (host === 'api.anthropic.com' || host.endsWith('.anthropic.com')) return 'anthropic';
  if (host.endsWith('.googleapis.com')) return 'google';
  if (host.endsWith('.aliyuncs.com')) return 'alibaba';
  return 'openai-compatible';
}
