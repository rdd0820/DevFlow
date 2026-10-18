import type { ModelMessage } from 'ai';

/**
 * 消息 content 数组里参与体积估算的片段。
 * 只读取文本、推理、工具入参和输出、图片与文件；工具名和调用标识不计入。
 */
type SizedPart = {
  /** 片段类型，如 text、reasoning、image、file、tool-call */
  type?: string;
  /** 文本或推理正文 */
  text?: unknown;
  /** 工具输出。存在该字段时按其 JSON 估算 */
  output?: unknown;
  /** 工具入参。为 null 或未传时不计入 */
  input?: unknown;
};

/**
 * 判断一个字符是否属于中日韩字符族。
 * 常用汉字、扩展 A、平假名、片假名、韩文音节和全角字符都算在内。
 * 这些字符大约一个字对应一个 token，不能按英文的四个字符一个 token 来算。
 *
 * @param char 单个字符。传入多字符时只看第一个码点
 * @returns 属于中日韩字符族时为 true
 */
export function isCJKChar(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xff00 && code <= 0xffef)
  );
}

/**
 * 单个字符折算成的 token 权重。
 * 中日韩字符记 1，其余记 0.25。用权重累加，避免每个英文字符都单独向上取整。
 *
 * @param char 单个字符
 * @returns 该字符的 token 权重
 */
export function charTokenWeight(char: string): number {
  return isCJKChar(char) ? 1 : 0.25;
}

/**
 * 估算一段纯文本占用的 token。
 * 中日韩字符每个记 1，其余字符每 4 个记 1，最后向上取整。空文本返回 0。
 *
 * @param text 待估算的文本
 * @returns 估算 token 数，至少为 0
 */
export function estimateTextTokensCJK(text: string): number {
  let cjkCount = 0;
  let otherCount = 0;
  for (const char of text) {
    if (isCJKChar(char)) {
      cjkCount += 1;
    } else {
      otherCount += 1;
    }
  }
  return Math.ceil(cjkCount + otherCount / 4);
}

/**
 * 估算消息列表的字符数，供和 token 估算对照。
 * 字符串正文按长度计；图片和文件按序列化后的长度计。工具名和调用标识很短，不计入。
 *
 * @param messages 发给模型的消息
 * @returns 字符总数。没有消息时为 0
 */
export function estimateMessageChars(messages: ModelMessage[]): number {
  let chars = 0;
  for (const message of messages) {
    chars += measureContent(message.content, (value) => value.length);
  }
  return chars;
}

/**
 * 估算消息列表占用的 token。
 * 每条消息先加 4，用来覆盖角色和消息边界；正文再按中日韩感知规则估算。
 * 消息越多，这 4 个固定开销越不能省，否则压缩会偏晚。
 *
 * @param messages 发给模型的消息
 * @returns 估算 token 数。没有消息时为 0
 */
export function estimateTokensCJK(messages: ModelMessage[]): number {
  let tokens = 0;
  for (const message of messages) {
    tokens += 4;
    tokens += measureContent(message.content, estimateTextTokensCJK);
  }
  return tokens;
}

/**
 * 把一条消息的正文交给测量函数。
 * 字符串直接测量；数组则累加文本、推理、工具入参、工具输出，以及图片和文件的序列化结果。
 *
 * @param content 消息正文，可能是字符串或片段数组
 * @param measure 对一段文本求长度或 token
 * @returns 该正文的测量值
 */
function measureContent(
  content: ModelMessage['content'],
  measure: (value: string) => number,
): number {
  if (typeof content === 'string') return measure(content);
  if (!Array.isArray(content)) return 0;
  let total = 0;
  for (const part of content as SizedPart[]) {
    if ((part.type === 'text' || part.type === 'reasoning') && typeof part.text === 'string') {
      total += measure(part.text);
    } else if ('output' in part) {
      total += measure(JSON.stringify(part.output));
    } else if (part.type === 'image' || part.type === 'file') {
      total += measure(JSON.stringify(part));
    }
    if ('input' in part && part.input != null) {
      total += measure(JSON.stringify(part.input));
    }
  }
  return total;
}
