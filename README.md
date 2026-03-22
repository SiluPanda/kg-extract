# kg-extract

Extract entity-relationship triples from unstructured text and build queryable in-memory knowledge graphs.

[![npm version](https://img.shields.io/npm/v/kg-extract.svg)](https://www.npmjs.com/package/kg-extract)
[![license](https://img.shields.io/npm/l/kg-extract.svg)](https://github.com/SiluPanda/kg-extract/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/kg-extract.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

## Description

`kg-extract` is an LLM-powered knowledge graph extraction library for TypeScript and JavaScript. It takes unstructured text, prompts a language model to identify entities and relationships, parses the results into structured triples, resolves duplicate entities, and assembles everything into a queryable in-memory knowledge graph.

The library is LLM-agnostic. You provide a function that calls any language model (OpenAI, Anthropic, Google, Cohere, Ollama, or any local model), and `kg-extract` handles prompt construction, output parsing, entity resolution, and graph assembly. Zero runtime dependencies.

## Installation

```bash
npm install kg-extract
```

## Quick Start

```typescript
import { extract, buildGraph, KnowledgeGraph } from 'kg-extract';

// Provide any LLM function: (prompt: string) => Promise<string>
const llm = async (prompt: string): Promise<string> => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content ?? '';
};

// Extract entities and triples from a single passage
const result = await extract(
  'Alice Johnson founded Acme Corp in New York in 2019.',
  { llm }
);
console.log(result.entities);
// [{ name: 'Alice Johnson', type: 'Person', aliases: [] },
//  { name: 'Acme Corp', type: 'Organization', aliases: [] },
//  { name: 'New York', type: 'Location', aliases: [] }]

console.log(result.triples);
// [{ subject: 'Alice Johnson', predicate: 'founded', object: 'Acme Corp', confidence: 0.95 },
//  { subject: 'Acme Corp', predicate: 'located_in', object: 'New York', confidence: 0.9 }]

// Build a full knowledge graph from multiple texts
const kg = await buildGraph(
  [
    'Alice Johnson founded Acme Corp in New York.',
    'Bob Smith joined Acme Corp as CTO in 2020.',
  ],
  { llm }
);

// Query the graph
const aliceRelations = kg.query('Alice Johnson');
const worksAtTriples = kg.query(undefined, 'works_at');
const path = kg.findPath('Alice Johnson', 'Bob Smith');
```

## Features

- **LLM-agnostic extraction** -- Bring any language model. Supports simple prompt functions and message-based function signatures.
- **Two-pass extraction pipeline** -- Entities are extracted first, then relationships are extracted with entity context, producing higher-quality triples.
- **Automatic passage splitting** -- Long texts are split into sentence-boundary passages to stay within token limits.
- **Entity resolution** -- Duplicate entities are merged across passages using case-insensitive matching, alias-based merging, and substring containment.
- **Queryable knowledge graph** -- Pattern-based triple queries, BFS path finding, neighbor traversal, and graph statistics.
- **Configurable entity types** -- Built-in types (Person, Organization, Location, Date, Event, Concept, Product) with support for custom types.
- **Confidence filtering** -- Triples carry confidence scores; filter out low-confidence extractions with `minConfidence`.
- **Serialization** -- Full JSON round-trip via `toJSON()` and `KnowledgeGraph.fromJSON()`.
- **Graph merging** -- Combine multiple knowledge graphs into one.
- **Reusable extractors** -- Create pre-configured extractor instances with `createExtractor()` for repeated use.
- **Zero runtime dependencies** -- Pure TypeScript implementation with no mandatory dependencies.

## API Reference

### `extract(text, options)`

Extracts entities and relationship triples from a single text passage.

```typescript
function extract(text: string, options: ExtractOptions): Promise<ExtractionResult>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | The input text to extract entities and relationships from. |
| `options` | `ExtractOptions` | Extraction configuration (see [Configuration](#configuration)). |

**Returns:** `Promise<ExtractionResult>`

---

### `buildGraph(texts, options)`

Processes one or more texts, extracts entities and triples, resolves duplicates, and assembles a `KnowledgeGraph`.

```typescript
function buildGraph(
  texts: string | string[],
  options: BuildGraphOptions
): Promise<KnowledgeGraph>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `texts` | `string \| string[]` | A single text or array of texts to process. |
| `options` | `BuildGraphOptions` | Extraction and graph-building configuration (see [Configuration](#configuration)). |

**Returns:** `Promise<KnowledgeGraph>`

Entity resolution is enabled by default. Disable it with `{ resolution: { enabled: false } }`.

---

### `createExtractor(config)`

Creates a pre-configured extractor instance for repeated use, avoiding repeated option setup.

```typescript
function createExtractor(config: ExtractorConfig): Extractor
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `ExtractorConfig` | Default configuration. `llm` is required; all other fields are optional. |

**Returns:** `Extractor` -- an object with `extract()` and `buildGraph()` methods that use the provided defaults, with per-call overrides supported.

```typescript
const extractor = createExtractor({ llm, minConfidence: 0.5 });

// Uses default config
const result = await extractor.extract('Some text.');

// Override minConfidence for this call
const result2 = await extractor.extract('Other text.', { minConfidence: 0.8 });

// Build a graph with the same defaults
const kg = await extractor.buildGraph(['Text one.', 'Text two.']);
```

---

### `KnowledgeGraph`

An in-memory directed labeled multigraph where nodes are entities and edges are relationship triples.

#### `addEntity(entity)`

Adds an entity node to the graph. If an entity with the same name (case-insensitive) already exists, the call is a no-op.

```typescript
addEntity(entity: Entity): void
```

#### `addTriple(triple)`

Adds a relationship triple to the graph. Automatically creates entity nodes for the subject and object if they do not already exist (with type `'unknown'`).

```typescript
addTriple(triple: Triple): void
```

#### `getEntity(name)`

Retrieves an entity by name. Lookup is case-insensitive.

```typescript
getEntity(name: string): Entity | undefined
```

#### `query(subject?, predicate?, object?)`

Pattern-based triple query. Pass `undefined` for any parameter to treat it as a wildcard. Matching is case-insensitive for subject and object, and exact for predicate.

```typescript
query(subject?: string, predicate?: string, object?: string): Triple[]
```

```typescript
// All triples where Alice is the subject
kg.query('Alice');

// All "works_at" relationships
kg.query(undefined, 'works_at');

// All triples pointing to Acme Corp
kg.query(undefined, undefined, 'Acme Corp');

// Specific triple pattern
kg.query('Alice', 'works_at', 'Acme Corp');
```

#### `getRelationships(name, direction?)`

Returns all triples connected to an entity, optionally filtered by direction.

```typescript
getRelationships(
  name: string,
  direction?: 'outgoing' | 'incoming' | 'both'
): Triple[]
```

| Direction | Description |
|-----------|-------------|
| `'outgoing'` | Triples where the entity is the subject. |
| `'incoming'` | Triples where the entity is the object. |
| `'both'` | All connected triples (default). |

#### `getNeighbors(name, depth?)`

Returns all entities within `depth` hops of the given entity using breadth-first traversal. The source entity is excluded from the result.

```typescript
getNeighbors(name: string, depth?: number): Entity[]
```

Default depth is `1`.

#### `findPath(from, to, options?)`

Finds the shortest directed path between two entities using BFS. Returns the sequence of triples forming the path, or `null` if no path exists. Returns an empty array if `from` and `to` are the same entity.

```typescript
findPath(
  from: string,
  to: string,
  options?: { maxDepth?: number }
): Triple[] | null
```

Default `maxDepth` is `5`.

#### `getEntitiesByType(type)`

Returns all entities of a given type. Type matching is case-insensitive.

```typescript
getEntitiesByType(type: string): Entity[]
```

#### `stats()`

Returns aggregate statistics about the graph.

```typescript
stats(): GraphStats
```

The returned `GraphStats` object contains:

| Field | Type | Description |
|-------|------|-------------|
| `nodeCount` | `number` | Total number of entities. |
| `edgeCount` | `number` | Total number of triples. |
| `avgDegree` | `number` | Average degree across all nodes. |
| `maxDegree` | `number` | Maximum degree of any node. |
| `mostConnected` | `string` | Name of the entity with the highest degree. |
| `entityTypes` | `Record<string, number>` | Count of entities per type. |
| `predicates` | `Record<string, number>` | Count of triples per predicate. |

#### `merge(other)`

Merges another `KnowledgeGraph` into this one. All entities and triples from the other graph are added.

```typescript
merge(other: KnowledgeGraph): void
```

#### `toJSON()`

Serializes the graph to a plain JSON object suitable for storage or transmission.

```typescript
toJSON(): GraphJSON
```

#### `KnowledgeGraph.fromJSON(json)`

Static method. Reconstructs a `KnowledgeGraph` from a previously serialized `GraphJSON` object.

```typescript
static fromJSON(json: GraphJSON): KnowledgeGraph
```

```typescript
// Serialize
const json = kg.toJSON();
const serialized = JSON.stringify(json);

// Deserialize
const restored = KnowledgeGraph.fromJSON(JSON.parse(serialized));
```

#### `entities()`

Returns an iterable iterator over all entities in the graph.

```typescript
*entities(): Iterable<Entity>
```

#### `triples()`

Returns an iterable iterator over all triples in the graph.

```typescript
*triples(): Iterable<Triple>
```

## Configuration

### `ExtractOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `llm` | `LLM` | *required* | The LLM function to call for extraction. |
| `entityTypes` | `string[]` | `undefined` | Custom entity types to look for. When provided, replaces the default set in the prompt. |
| `maxPassageTokens` | `number` | `1500` | Maximum estimated tokens per passage when splitting long text (approx 4 chars per token). |
| `minConfidence` | `number` | `0.3` | Minimum confidence threshold. Triples below this are discarded. |
| `structuredOutput` | `boolean` | `false` | When `true`, use strict structured output mode. |

### `BuildGraphOptions`

Extends `ExtractOptions` with:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `resolution.enabled` | `boolean` | `true` | Enable or disable entity resolution. |

### `ExtractorConfig`

Same as `Partial<ExtractOptions>` with `llm` required. Used with `createExtractor()`.

### LLM Function Signatures

`kg-extract` accepts two LLM function signatures:

**Simple prompt function:**

```typescript
type LLMFunction = (prompt: string) => Promise<string>
```

**Message-based function:**

```typescript
type LLMMessageFunction = (messages: LLMMessage[]) => Promise<string>

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

The library detects which signature you provide by checking the function's `.length` property. Functions with arity 0 or 1 are treated as simple prompt functions; all others are treated as message-based.

## Error Handling

Since `kg-extract` delegates to a caller-provided LLM function, errors can originate from the LLM call itself. Wrap extraction calls in try/catch to handle LLM failures:

```typescript
try {
  const result = await extract('Some text.', { llm });
} catch (error) {
  // LLM call failures propagate as-is
  console.error('Extraction failed:', error);
}
```

If the LLM returns output that cannot be parsed into entities or triples, the corresponding arrays in the result will be empty rather than throwing. Check `result.warnings` for diagnostic information.

When no entities are extracted from a passage, the relationship extraction step is skipped entirely for that passage, saving an LLM call.

## Advanced Usage

### Custom Entity Types

Restrict or extend the types of entities the LLM looks for:

```typescript
const result = await extract(
  'The golden retriever was bred in Scotland.',
  {
    llm,
    entityTypes: ['Animal', 'Breed', 'Country'],
  }
);
```

When `entityTypes` is provided, only those types are included in the extraction prompt.

### Pre-configured Extractor

For applications that repeatedly extract from many texts with the same configuration:

```typescript
const extractor = createExtractor({
  llm,
  minConfidence: 0.5,
  entityTypes: ['Person', 'Organization', 'Product'],
});

// Extract from many documents
for (const doc of documents) {
  const result = await extractor.extract(doc.text);
  // process result...
}

// Or build a single graph from all documents
const kg = await extractor.buildGraph(documents.map(d => d.text));
```

Per-call overrides take precedence over the extractor defaults:

```typescript
// Override minConfidence just for this call
const result = await extractor.extract(doc.text, { minConfidence: 0.9 });
```

### Graph Traversal and Path Finding

Explore entity neighborhoods and find connections:

```typescript
const kg = await buildGraph(texts, { llm });

// Get all entities within 2 hops of "Albert Einstein"
const nearby = kg.getNeighbors('Albert Einstein', 2);

// Find shortest directed path between two entities
const path = kg.findPath('Albert Einstein', 'Nobel Prize');
if (path) {
  for (const triple of path) {
    console.log(`${triple.subject} --[${triple.predicate}]--> ${triple.object}`);
  }
}

// Get outgoing relationships only
const outgoing = kg.getRelationships('Albert Einstein', 'outgoing');
```

### Merging Graphs

Combine knowledge graphs built from different sources:

```typescript
const kg1 = await buildGraph(articlesFromSourceA, { llm });
const kg2 = await buildGraph(articlesFromSourceB, { llm });

kg1.merge(kg2);

console.log(kg1.stats());
// { nodeCount: 42, edgeCount: 87, ... }
```

### Serialization and Persistence

Save and restore graphs:

```typescript
import { KnowledgeGraph } from 'kg-extract';
import { writeFileSync, readFileSync } from 'node:fs';

// Save to disk
const json = kg.toJSON();
writeFileSync('knowledge-graph.json', JSON.stringify(json, null, 2));

// Load from disk
const data = JSON.parse(readFileSync('knowledge-graph.json', 'utf-8'));
const restored = KnowledgeGraph.fromJSON(data);

// Verify
console.log(restored.stats().nodeCount);
```

### Disabling Entity Resolution

If you want raw extraction results without any entity merging:

```typescript
const kg = await buildGraph(texts, {
  llm,
  resolution: { enabled: false },
});
```

### Using a Message-Based LLM

If your LLM client uses a message array interface:

```typescript
import type { LLMMessage } from 'kg-extract';

const messageLLM = async (messages: LLMMessage[]): Promise<string> => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    max_tokens: 4096,
  });
  return response.content[0].text;
};

const result = await extract('Some text.', { llm: messageLLM });
```

## TypeScript

`kg-extract` is written in strict TypeScript and ships type declarations alongside the compiled JavaScript. All public types are exported from the package entry point:

```typescript
import type {
  Entity,
  EntityType,
  Triple,
  ExtractionResult,
  LLM,
  LLMFunction,
  LLMMessage,
  LLMMessageFunction,
  ExtractOptions,
  BuildGraphOptions,
  ExtractorConfig,
  Extractor,
  GraphStats,
  GraphJSON,
} from 'kg-extract';
```

## License

MIT
