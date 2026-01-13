import type { UIMessage } from 'ai'
import type { MessageUsage } from '../message-usage'

export interface MessageMeta {
  usage?: MessageUsage
  modelId?: string
}

export type ReasoningSession = { startedAt: number; endedAt?: number }

export function getMessageText(message: UIMessage): string {
  const msg = message as any
  if (typeof msg.content === 'string' && msg.content.length > 0) {
    return msg.content
  }

  if (message.parts && message.parts.length > 0) {
    return message.parts
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text',
      )
      .map((part) => part.text)
      .join('')
  }

  return ''
}

export function getReasoningParts(message: UIMessage): Array<{
  type: 'reasoning'
  text: string
  state?: 'streaming' | 'done'
}> {
  if (!message.parts) return []
  return message.parts.filter(
    (
      part,
    ): part is {
      type: 'reasoning'
      text: string
      state?: 'streaming' | 'done'
    } => part.type === 'reasoning',
  )
}

export function getReasoningText(message: UIMessage): string {
  return getReasoningParts(message)
    .map((part) => part.text)
    .join('')
}

export function formatThoughtDuration(seconds: number): string {
  if (seconds === 1) return '1 second'
  return `${seconds} seconds`
}

export function messageAnchorId(id: string): string {
  return `message-${id}`
}

export function getMessageMeta(message: UIMessage): MessageMeta | undefined {
  const msg = message as any

  if (msg.metadata?.usage) {
    const usage: MessageUsage = {
      inputTokens: msg.metadata.usage.inputTokens,
      outputTokens: msg.metadata.usage.outputTokens,
      totalTokens: msg.metadata.usage.totalTokens,
      reasoningTokens: msg.metadata.usage.reasoningTokens,
    }

    if (msg.metadata.gatewayCost) {
      usage.gatewayCost = msg.metadata.gatewayCost
    }

    return {
      usage,
      modelId: msg.metadata.model,
    }
  }

  return undefined
}
