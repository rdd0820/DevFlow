import {
  type UIMessage,
  type UIMessageChunk,
  Output,
  convertToModelMessages,
  createUIMessageStream,
  generateText,
  streamText,
  toUIMessageStream,
} from 'ai';
import { z } from 'zod';

import { getMainModel, providerOptions } from '../models';

/** 单次模型调用的最长等待时间。超时后不再重试，由调用方改用启发式结果 */
const LLM_TIMEOUT_MS = 60_000;

/** 流式失败时写给前端的固定说明。不把上游错误原文传出 */
const STREAM_ERROR_TEXT = '模型暂时无法回复';

/**
 * 按结构化 schema 生成对象。
 * 没有密钥，或请求超时、响应无法解析时返回 null。
 */
export async function structured<T>(
  systemPrompt: string,
  payload: unknown,
  schema: z.ZodType<T>,
): Promise<T | null> {
  try {
    const result = await generateText({
      model: getMainModel(),
      system: systemPrompt,
      prompt: JSON.stringify(payload),
      output: Output.object({ schema }),
      maxRetries: 0,
      timeout: LLM_TIMEOUT_MS,
      providerOptions,
    });
    return result.output ?? null;
  } catch {
    return null;
  }
}

/**
 * 生成一段纯文本。
 * 没有密钥或调用失败时返回空字符串，调用方据此改走抽取式或规则结果。
 */
export async function text(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const result = await generateText({
      model: getMainModel(),
      system: systemPrompt,
      prompt: userMessage,
      maxRetries: 0,
      timeout: LLM_TIMEOUT_MS,
      providerOptions,
    });
    return result.text ?? '';
  } catch {
    return '';
  }
}

/**
 * 把一轮对话变成 UI 消息流。
 * 返回的块可以直接写成 SSE。没有密钥时流立刻结束，不写正文。
 * 模型中途失败时写入固定错误，已经产出的文本块保留。
 */
export function stream(
  systemPrompt: string,
  messages: UIMessage[],
): ReadableStream<UIMessageChunk> {
  return createUIMessageStream({
    originalMessages: messages,
    onError: () => STREAM_ERROR_TEXT,
    execute: async ({ writer }) => {
      // 主模型。未配置密钥时结束流，不写正文。
      let model: ReturnType<typeof getMainModel>;
      try {
        model = getMainModel();
      } catch {
        return;
      }
      const result = streamText({
        model,
        system: systemPrompt,
        messages: await convertToModelMessages(messages),
        maxRetries: 0,
        timeout: LLM_TIMEOUT_MS,
        providerOptions,
      });
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          originalMessages: messages,
          onError: () => STREAM_ERROR_TEXT,
        }),
      );
    },
  });
}
