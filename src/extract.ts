import type { LLM, LLMFunction, LLMMessageFunction, ExtractOptions, BuildGraphOptions, ExtractorConfig, Extractor, ExtractionResult, Entity } from './types.js'
import { entityExtractionPrompt, relationshipExtractionPrompt } from './prompts.js'
import { parseEntities, parseTriples } from './parser.js'
import { resolveEntities, resolveTriples } from './resolution.js'
import { KnowledgeGraph } from './graph.js'

async function callLLM(llm: LLM, prompt: string): Promise<string> {
  if (typeof llm === 'function' && llm.length <= 1) {
    return (llm as LLMFunction)(prompt)
  }
  return (llm as LLMMessageFunction)([{ role: 'user', content: prompt }])
}

function splitPassages(text: string, maxTokens: number): string[] {
  const approxChars = maxTokens * 4
  if (text.length <= approxChars) return [text]
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text]
  const passages: string[] = []
  let current = ''
  for (const s of sentences) {
    if ((current + s).length > approxChars && current) {
      passages.push(current.trim())
      current = s
    } else {
      current += s
    }
  }
  if (current.trim()) passages.push(current.trim())
  return passages
}

export async function extract(text: string, options: ExtractOptions): Promise<ExtractionResult> {
  const start = Date.now()
  const passages = splitPassages(text, options.maxPassageTokens ?? 1500)
  const minConfidence = options.minConfidence ?? 0.3
  let llmCalls = 0
  const allEntities: Entity[] = []
  const allTriples: ExtractionResult['triples'] = []

  for (const passage of passages) {
    const entityOutput = await callLLM(options.llm, entityExtractionPrompt(passage, options.entityTypes))
    llmCalls++
    const entities = parseEntities(entityOutput)
    allEntities.push(...entities)

    if (entities.length > 0) {
      const tripleOutput = await callLLM(options.llm, relationshipExtractionPrompt(passage, entities))
      llmCalls++
      allTriples.push(
        ...parseTriples(tripleOutput, minConfidence).map(t => ({ ...t, sourceText: passage }))
      )
    }
  }

  return {
    entities: allEntities,
    triples: allTriples,
    llmCalls,
    llmDurationMs: Date.now() - start,
    warnings: [],
    text,
  }
}

export async function buildGraph(
  texts: string | string[],
  options: BuildGraphOptions
): Promise<KnowledgeGraph> {
  const textArr = Array.isArray(texts) ? texts : [texts]
  const kg = new KnowledgeGraph()

  for (const text of textArr) {
    const result = await extract(text, options)
    const { resolved, mergeMap } =
      options.resolution?.enabled !== false
        ? resolveEntities(result.entities)
        : { resolved: result.entities, mergeMap: new Map<string, string>() }
    const resolvedTriples = resolveTriples(result.triples, mergeMap)
    for (const e of resolved) kg.addEntity(e)
    for (const t of resolvedTriples) kg.addTriple(t)
  }

  return kg
}

export function createExtractor(config: ExtractorConfig): Extractor {
  return {
    extract: (text, overrides) =>
      extract(text, { ...config, ...overrides, llm: overrides?.llm ?? config.llm }),
    buildGraph: (texts, overrides) =>
      buildGraph(texts, { ...config, ...overrides, llm: overrides?.llm ?? config.llm }),
  }
}
