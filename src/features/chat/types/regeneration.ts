export type RegenerationMode =
  | 'try-again'
  | 'expand'
  | 'concise'
  | 'instruction'
  | 'switch-model'

export interface RegenerationOptions {
  mode?: RegenerationMode
  instruction?: string
  assistantText?: string
  modelId?: string
}
