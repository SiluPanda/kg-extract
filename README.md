# kg-extract

Extract entity-relationship triples from text and build knowledge graphs. Caller provides the LLM function — zero external runtime dependencies.

## Install

```bash
npm install kg-extract
```

## Quick start

```typescript
import { extract, buildGraph, createExtractor } from 'kg-extract'

// Any function that calls an LLM — OpenAI, Anthropic, local, etc.
const llm = async (prompt: string) => {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  })
  return res.choices[0].message.content ?? ''
}

// One-shot extraction
const result = await extract('Alice founded Acme Corp in 2010 in San Francisco.', { llm })
console.log(result.entities) // [{ name: 'Alice', type: 'Person' }, ...]
console.log(result.triples)  // [{ subject: 'Alice', predicate: 'founded', object: 'Acme Corp', confidence: 0.9 }]

// Build a graph from one or more passages
const kg = await buildGraph(
  ['Alice founded Acme Corp.', 'Acme Corp is headquartered in San Francisco.'],
  { llm }
)

// Graph queries
const aliceTriples = kg.query('Alice')          // all triples where Alice is subject
const acmeRelations = kg.getRelationships('Acme Corp', 'both')
const path = kg.findPath('Alice', 'San Francisco')
const neighbors = kg.getNeighbors('Acme Corp', 1)
const stats = kg.stats()
```

## createExtractor

Bind a shared config once and reuse:

```typescript
const extractor = createExtractor({ llm, minConfidence: 0.5, entityTypes: ['Person', 'Organization'] })

const result = await extractor.extract('Some text')
const kg = await extractor.buildGraph(['Passage one.', 'Passage two.'])
```

## KnowledgeGraph API

| Method | Description |
|--------|-------------|
| `addEntity(entity)` | Add an entity node |
| `addTriple(triple)` | Add a triple (auto-creates missing nodes) |
| `getEntity(name)` | Look up entity by name (case-insensitive) |
| `query(subject?, predicate?, object?)` | Filter triples by any combination |
| `getRelationships(name, direction?)` | Get outgoing / incoming / both triples |
| `getNeighbors(name, depth?)` | BFS neighbor entities |
| `findPath(from, to, options?)` | BFS path as triple array, or null |
| `getEntitiesByType(type)` | Filter entities by type |
| `stats()` | Node/edge counts, degree, top predicates |
| `merge(other)` | Combine another graph in-place |
| `toJSON()` | Serialize to plain object |
| `KnowledgeGraph.fromJSON(json)` | Deserialize |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `llm` | required | `(prompt: string) => Promise<string>` or messages variant |
| `entityTypes` | standard set | Entity types to extract |
| `maxPassageTokens` | `1500` | Max tokens per passage (approx 4 chars/token) |
| `minConfidence` | `0.3` | Minimum triple confidence threshold |
| `resolution.enabled` | `true` | Enable 3-phase entity deduplication |

## License

MIT
