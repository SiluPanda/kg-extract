export type EntityType = 'Person' | 'Organization' | 'Location' | 'Date' | 'Event' | 'Concept' | 'Product' | string

export interface Entity {
  name: string
  type: EntityType
  aliases?: string[]
  properties?: Record<string, unknown>
}

export interface Triple {
  subject: string
  predicate: string
  object: string
  confidence: number
  sourceText?: string
}

export interface ExtractionResult {
  entities: Entity[]
  triples: Triple[]
  llmCalls: number
  llmDurationMs: number
  warnings: string[]
  text: string
}

export type LLMFunction = (prompt: string) => Promise<string>
export interface LLMMessage { role: 'system' | 'user' | 'assistant'; content: string }
export type LLMMessageFunction = (messages: LLMMessage[]) => Promise<string>
export type LLM = LLMFunction | LLMMessageFunction

export interface ExtractOptions {
  llm: LLM
  entityTypes?: string[]
  maxPassageTokens?: number   // default 1500
  minConfidence?: number      // default 0.3
  structuredOutput?: boolean  // default false (use text prompts)
}

export interface BuildGraphOptions extends ExtractOptions {
  resolution?: { enabled?: boolean }
}

export interface ExtractorConfig extends Partial<ExtractOptions> { llm: LLM }

export interface Extractor {
  extract(text: string, overrides?: Partial<ExtractOptions>): Promise<ExtractionResult>
  buildGraph(texts: string | string[], overrides?: Partial<BuildGraphOptions>): Promise<KnowledgeGraph>
}

export interface GraphStats {
  nodeCount: number
  edgeCount: number
  avgDegree: number
  maxDegree: number
  mostConnected: string
  entityTypes: Record<string, number>
  predicates: Record<string, number>
}

export interface GraphJSON {
  entities: Array<{ name: string; type: string; aliases: string[]; properties: Record<string, unknown> }>
  triples: Triple[]
  metadata: { createdAt: string; entityCount: number; tripleCount: number }
}

// Forward declaration so types.ts compiles standalone; KnowledgeGraph is imported where needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KnowledgeGraph = any
