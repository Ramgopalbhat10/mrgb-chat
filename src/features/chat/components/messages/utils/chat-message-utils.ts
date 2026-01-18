import type { UIMessage } from 'ai'
import type { MessageUsage } from '../message-usage'

export interface MessageMeta {
  usage?: MessageUsage
  modelId?: string
}

export type ReasoningSession = { startedAt: number; endedAt?: number }

const THINK_OPEN = '<think>'
const THINK_CLOSE = '</think>'

function extractThinkBlocks(text: string) {
  const lower = text.toLowerCase()
  let displayText = ''
  let reasoningText = ''
  let cursor = 0
  let hasThink = false
  let isStreaming = false

  while (cursor < text.length) {
    const openIndex = lower.indexOf(THINK_OPEN, cursor)
    if (openIndex === -1) {
      displayText += text.slice(cursor)
      break
    }
    hasThink = true
    displayText += text.slice(cursor, openIndex)
    const afterOpen = openIndex + THINK_OPEN.length
    const closeIndex = lower.indexOf(THINK_CLOSE, afterOpen)
    if (closeIndex === -1) {
      reasoningText += text.slice(afterOpen)
      isStreaming = true
      cursor = text.length
      break
    }
    reasoningText += text.slice(afterOpen, closeIndex)
    cursor = closeIndex + THINK_CLOSE.length
  }

  if (hasThink) {
    displayText = displayText.replace(/<\/?think>/gi, '')
    reasoningText = reasoningText.replace(/<\/?think>/gi, '')
  }

  const state = (isStreaming ? 'streaming' : 'done') as 'streaming' | 'done'

  return {
    displayText,
    reasoningText,
    hasThink,
    state,
  }
}

function getRawText(message: UIMessage): string {
  if (message.parts && message.parts.length > 0) {
    return message.parts
      .filter(
        (part): part is { type: 'text'; text: string } => part.type === 'text',
      )
      .map((part) => part.text)
      .join('')
  }

  const msg = message as any
  if (typeof msg.content === 'string' && msg.content.length > 0) {
    return msg.content
  }

  return ''
}

export function getMessageText(message: UIMessage): string {
  const rawText = getRawText(message)
  if (!rawText) return ''
  const role = (message as any).role
  if (role === 'assistant' && rawText.toLowerCase().includes(THINK_OPEN)) {
    const { displayText } = extractThinkBlocks(rawText)
    return displayText.replace(/^\s+/, '')
  }
  return rawText
}

export function getReasoningParts(message: UIMessage): Array<{
  type: 'reasoning'
  text: string
  state?: 'streaming' | 'done'
}> {
  const explicit = message.parts?.filter(
    (
      part,
    ): part is {
      type: 'reasoning'
      text: string
      state?: 'streaming' | 'done'
    } => part.type === 'reasoning',
  )
  if (explicit && explicit.length > 0) return explicit

  const role = (message as any).role
  if (role !== 'assistant') return []

  const rawText = getRawText(message)
  if (!rawText || !rawText.toLowerCase().includes(THINK_OPEN)) return []

  const { reasoningText, hasThink, state } = extractThinkBlocks(rawText)
  if (!hasThink || !reasoningText.trim()) return []

  return [
    {
      type: 'reasoning' as const,
      text: reasoningText.trim(),
      state,
    },
  ]
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
