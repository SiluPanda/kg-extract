# kg-extract -- Task Breakdown

This file tracks all implementation tasks derived from the SPEC.md. Tasks are organized by implementation phase, matching the spec's roadmap (Section 20).

---

## Phase 0: Project Scaffolding and Setup

- [x] **Install dev dependencies** -- Add `typescript`, `vitest`, and `eslint` as devDependencies in `package.json`. Run `npm install` to generate `node_modules` and `package-lock.json`. | Status: done
- [x] **Configure ESLint** -- Create `.eslintrc` (or `eslint.config.js`) with a TypeScript-compatible ruleset. Ensure `npm run lint` works against `src/`. | Status: done
- [x] **Configure Vitest** -- Create `vitest.config.ts` if needed. Ensure `npm run test` runs tests from `src/__tests__/`. | Status: done
- [ ] **Create directory structure** -- Create all subdirectories under `src/` as specified in Section 19: `prompts/`, `parse/`, `normalize/`, `resolve/`, `graph/`, `serialize/`, `adapters/`, `split/`, and `__tests__/` with its mirrored subdirectories (`prompts/`, `parse/`, `normalize/`, `resolve/`, `graph/`, `serialize/`) and `fixtures/`. | Status: not_done
- [ ] **Create placeholder files** -- Create empty (or stub-export) `.ts` files for every source file listed in Section 19's file structure to establish the project skeleton. | Status: not_done
- [x] **Verify build pipeline** -- Run `npm run build` and confirm `tsc` compiles the placeholder files to `dist/` without errors. | Status: done

---

## Phase 1: Core Extraction Pipeline (v0.1.0)

### 1.1 Type Definitions

- [ ] **Define `BuiltInEntityType` type** -- Create `src/types.ts`. Define the union type `'Person' | 'Organization' | 'Location' | 'Date' | 'Event' | 'Concept' | 'Product'` as specified in Section 4 and Section 13. | Status: not_done
- [x] **Define `EntityType` type** -- `BuiltInEntityType | string` to allow custom types. | Status: done
- [ ] **Define `CustomEntityType` interface** -- `{ name: string; description: string }` for caller-provided entity types. | Status: not_done
- [x] **Define `Entity` interface** -- `{ name: string; type: EntityType; aliases?: string[]; properties?: Record<string, unknown> }`. | Status: done
- [x] **Define `Triple` interface** -- `{ subject: string; predicate: string; object: string; confidence: number; sourceText?: string; sourcePassage?: number; properties?: Record<string, unknown> }`. | Status: done
- [ ] **Define `RawTriple` interface** -- Internal type for pre-normalization triples with optional confidence (Section 5, Step 3). | Status: not_done
- [x] **Define `ExtractionResult` interface** -- `{ entities, triples, llmCalls, llmDurationMs, warnings, text, passages? }` as specified in Section 13. | Status: done
- [x] **Define `LLMFunction` type** -- `(prompt: string) => Promise<string>`. | Status: done
- [x] **Define `LLMMessage` interface** -- `{ role: 'system' | 'user' | 'assistant'; content: string }`. | Status: done
- [x] **Define `LLMMessageFunction` type** -- `(messages: LLMMessage[]) => Promise<string>`. | Status: done
- [x] **Define `LLM` union type** -- `LLMFunction | LLMMessageFunction`. | Status: done
- [ ] **Define `PredicateConstraint` interface** -- `{ name: string; description: string }`. | Status: not_done
- [ ] **Define `PromptTemplates` interface** -- Custom prompt template structure with optional `entityExtraction` and `relationshipExtraction` fields, each with `system?` string and `user?` function. | Status: not_done
- [ ] **Define `ExtractOptions` interface** -- All options for `extract()`: `llm`, `entityTypes`, `predicates`, `extractProperties`, `combinedExtraction`, `structuredOutput`, `promptTemplates`, `examples`, `maxPassageTokens`, `minPassageTokens`, `concurrency`, `minConfidence`. | Status: not_done
- [x] **Define `BuildGraphOptions` interface** -- Extends `ExtractOptions` with `resolution` config object, `entityResolver` hook, and `splitter` function. | Status: done
- [ ] **Define `EntityResolutionResult` interface** -- `{ mergeMap: Record<string, string>; entities: Entity[] }`. | Status: not_done
- [x] **Define `ExtractorConfig` interface** -- `Partial<BuildGraphOptions>` with required `llm`. | Status: done
- [x] **Define `Extractor` interface** -- `{ extract(text, overrides?): Promise<ExtractionResult>; buildGraph(texts, overrides?): Promise<KnowledgeGraph> }`. | Status: done
- [ ] **Define `EntityNode` interface** -- `{ entity: Entity; outgoing: Triple[]; incoming: Triple[] }`. | Status: not_done
- [x] **Define `GraphStats` interface** -- `{ nodeCount, edgeCount, connectedComponents, avgDegree, maxDegree, mostConnected, entityTypes, predicates }`. | Status: done
- [x] **Define `GraphJSON` interface** -- JSON serialization shape with `entities`, `triples`, and `metadata` fields. | Status: done
- [ ] **Define `QueryOptions` interface** -- `{ filter?: (triple: Triple) => boolean; limit?: number }`. | Status: not_done
- [ ] **Define `PathOptions` interface** -- `{ maxDepth?: number; directed?: boolean }`. | Status: not_done
- [ ] **Define `Edge` interface** -- Internal type for graph edges: `{ subject, predicate, object, confidence, sourceText?, sourcePassage?, properties? }`. | Status: not_done

### 1.2 Error Handling

- [ ] **Implement `ExtractionError` class** -- In `src/errors.ts`, create a class extending `Error` with a `code` property. Supported codes: `'NO_LLM'`, `'EMPTY_TEXT'`, `'LLM_FAILED'`, `'PARSE_FAILED'`, `'ENTITY_NOT_FOUND'`, `'INVALID_OPTIONS'`. | Status: not_done
- [ ] **Write tests for `ExtractionError`** -- Verify the error class sets `code`, `message`, and `name` correctly. Verify `instanceof ExtractionError` works. | Status: not_done

### 1.3 LLM Interface

- [x] **Implement LLM function detection** -- In `src/extract.ts` (or a utility), detect whether the caller provided a simple `(prompt: string) => Promise<string>` function or a message-based `(messages: LLMMessage[]) => Promise<string>` function by checking `.length`. | Status: done
- [x] **Implement LLM call wrapper** -- Create an internal helper that accepts system/user messages and calls the LLM using the appropriate interface. If simple function, concatenate system + user into a single prompt. If message-based, pass as a messages array. Track call count and duration for `ExtractionResult`. | Status: done
- [ ] **Write tests for LLM function detection** -- Test that a function with `.length === 1` and string parameter is detected as simple. Test that a function accepting an array is detected as message-based. | Status: not_done

### 1.4 Entity Extraction Prompt

- [x] **Implement entity extraction system prompt** -- In `src/prompts/entity-prompt.ts`, build the system message as specified in Section 6 (entity extraction rules, output format, coreference instructions). Support injecting custom entity types into the type list. | Status: done
- [x] **Implement entity extraction user prompt** -- Build the user message with the passage text wrapped in `---` delimiters. | Status: done
- [ ] **Implement few-shot example injection** -- In `src/prompts/examples.ts`, define 2-3 built-in few-shot examples for entity extraction. Inject them into the prompt when enabled (default: enabled). Support caller-provided examples via `options.examples`. Support disabling with `examples: []`. | Status: not_done
- [x] **Implement custom entity type injection** -- When `options.entityTypes` is provided, append custom types to the built-in type list in the system prompt with their descriptions. | Status: done
- [ ] **Write tests for entity extraction prompt construction** -- Verify system message contains all built-in types. Verify custom types are appended. Verify few-shot examples are included by default and can be disabled. Verify passage text appears in user message. | Status: not_done

### 1.5 Relationship Extraction Prompt

- [x] **Implement relationship extraction system prompt** -- In `src/prompts/relationship-prompt.ts`, build the system message as specified in Section 7 (relationship rules, decomposition instructions, output format). | Status: done
- [x] **Implement relationship extraction user prompt** -- Build the user message with passage text and entity list JSON. | Status: done
- [ ] **Implement predicate constraint injection** -- When `options.predicates` is provided, add a section to the system prompt listing allowed predicates with descriptions, instructing the LLM to only use those predicates. | Status: not_done
- [ ] **Implement extractProperties prompt variant** -- When `options.extractProperties` is true, modify the prompt to instruct the LLM to include additional properties on each triple. | Status: not_done
- [ ] **Implement combined extraction prompt** -- When `options.combinedExtraction` is true, build a single prompt that asks for both entities and relationships in one LLM call. Define the expected combined output format. | Status: not_done
- [ ] **Write tests for relationship extraction prompt construction** -- Verify entity list injection. Verify predicate constraints appear when provided. Verify combined mode produces a single prompt. Verify extractProperties modifies the prompt. | Status: not_done

### 1.6 JSON Output Parser

- [ ] **Implement clean JSON parsing** -- In `src/parse/json-parser.ts`, attempt `JSON.parse()` on the raw LLM output. Return the parsed array on success. | Status: not_done
- [ ] **Implement markdown code fence stripping** -- Detect and strip `` ```json ... ``` `` or `` ``` ... ``` `` wrappers before parsing. | Status: not_done
- [ ] **Implement JSON with preamble extraction** -- If the output contains explanatory text, extract the first `[...]` block using bracket matching and parse it. | Status: not_done
- [ ] **Implement single-quote replacement** -- Replace single quotes with double quotes, being careful not to replace apostrophes within string values (e.g., "O'Brien"). | Status: not_done
- [ ] **Implement trailing comma removal** -- Remove trailing commas before `]` or `}`. | Status: not_done
- [ ] **Implement structured output mode** -- When `options.structuredOutput` is true, skip all heuristic fixes and parse as strict JSON. Throw on failure instead of retrying. | Status: not_done
- [ ] **Write tests for JSON parser** -- Test all six cases: clean JSON, markdown-wrapped, preamble, single quotes, trailing commas, and complete parse failure. Test structured output mode. Test nested JSON objects. Test edge cases (empty array, empty string, null). | Status: not_done

### 1.7 Entity Validation

- [ ] **Implement entity validation** -- In `src/parse/entity-validator.ts`, validate each parsed entity object: `name` must be non-empty string; `type` must be a recognized type (default to `'Concept'` if unknown); `aliases` must be array of strings (filter non-strings); discard entities with missing name. | Status: not_done
- [ ] **Collect validation warnings** -- When an entity is discarded or a type is defaulted, add a warning message to the warnings array. | Status: not_done
- [ ] **Write tests for entity validation** -- Test valid entity. Test missing name (discarded). Test unknown type (defaults to Concept). Test non-string aliases (filtered). Test empty aliases array. Test entity with all optional fields missing. | Status: not_done

### 1.8 Triple Validation

- [ ] **Implement triple validation** -- In `src/parse/triple-validator.ts`, validate each parsed triple: subject/predicate/object must be non-empty strings; confidence must be number in [0,1] (clamp if outside, default to 1.0 if missing); discard triples with empty subject/predicate/object. | Status: not_done
- [ ] **Implement entity name matching for triples** -- Match subject and object names to extracted entity names using case-insensitive comparison. If no match, add the unmatched name as a new entity with type `'Concept'`. | Status: not_done
- [ ] **Collect validation warnings** -- When a triple is discarded or a new entity is auto-created, add a warning. | Status: not_done
- [ ] **Write tests for triple validation** -- Test valid triple. Test empty subject (discarded). Test confidence out of range (clamped). Test missing confidence (defaults to 1.0). Test entity name case-insensitive matching. Test auto-creation of unmatched entity. | Status: not_done

### 1.9 Extract Pipeline Orchestration

- [x] **Implement `extract()` function** -- In `src/extract.ts`, orchestrate the full pipeline: validate options (throw `ExtractionError` with `NO_LLM` if no LLM, `EMPTY_TEXT` if empty text), build entity extraction prompt, call LLM, parse entities, build relationship extraction prompt with entities, call LLM, parse triples, validate, assemble `ExtractionResult`. | Status: done
- [x] **Implement two-step extraction mode** -- Default mode: two separate LLM calls (entity then relationship). | Status: done
- [ ] **Implement combined extraction mode** -- When `combinedExtraction: true`, use a single LLM call for both entities and relationships. Parse the combined output format. | Status: not_done
- [ ] **Implement retry on parse failure** -- When JSON parsing fails after all heuristic fixes, send a corrective prompt to the LLM with the failed output, asking it to fix the JSON. Maximum 1 retry per extraction step. If retry also fails, return empty result for that step and add warning. | Status: not_done
- [x] **Implement minConfidence filtering** -- After validation, discard triples with confidence below `options.minConfidence` (default: 0.0, include all). | Status: done
- [x] **Track LLM call metrics** -- Count all LLM calls (including retries) and measure total LLM duration in milliseconds. Populate `llmCalls` and `llmDurationMs` in the result. | Status: done
- [ ] **Wire up custom prompt templates** -- When `options.promptTemplates` is provided, use the custom templates instead of built-in ones. Still use built-in parsing and validation on the output. | Status: not_done
- [ ] **Implement concurrency control** -- When processing multiple passages, limit concurrent LLM calls to `options.concurrency` (default: 3). Use a simple semaphore or `Promise` pool. | Status: not_done
- [x] **Export `extract()` from index.ts** -- Update `src/index.ts` to export the `extract` function and all public types. | Status: done
- [x] **Write integration tests for `extract()`** -- Test single passage with mock LLM returning known entities and triples. Verify `ExtractionResult` fields. Test two-step vs combined mode. Test retry on parse failure. Test error cases (no LLM, empty text). Test minConfidence filtering. | Status: done

---

## Phase 2: Normalization and Entity Resolution (v0.2.0)

### 2.1 Entity Name Normalization

- [ ] **Implement whitespace normalization** -- In `src/normalize/entity-name.ts`, trim leading/trailing whitespace and collapse internal whitespace to single spaces. | Status: not_done
- [ ] **Implement title case for Person and Organization types** -- Apply title case to entity names of type Person and Organization: "albert einstein" becomes "Albert Einstein". | Status: not_done
- [ ] **Preserve original casing for other types** -- For Location, Product, Concept, Date, Event types, preserve original casing (acronyms and proper nouns should not be re-cased). | Status: not_done
- [ ] **Implement article stripping** -- Strip leading articles ("the", "a", "an") when not part of the proper name. Preserve known exceptions like "The Hague". Maintain a list of exceptions or use a heuristic (e.g., if the article is followed by a capitalized word that is not a common adjective). | Status: not_done
- [ ] **Write tests for entity name normalization** -- Test whitespace trimming and collapsing. Test title casing for Person/Org. Test case preservation for Location/Product/Concept. Test article stripping ("the United Nations" -> "United Nations"). Test exception preservation ("The Hague" stays). Test special characters (accents, apostrophes, hyphens). | Status: not_done

### 2.2 Predicate Normalization

- [ ] **Implement lowercase conversion** -- In `src/normalize/predicate.ts`, convert predicate strings to lowercase. | Status: not_done
- [ ] **Implement space/hyphen to underscore** -- Replace spaces and hyphens with underscores. | Status: not_done
- [ ] **Implement auxiliary verb stripping** -- Strip leading auxiliary verbs from a fixed list: `was`, `is`, `are`, `were`, `has`, `have`, `had`, `been`. "was born in" becomes "born_in", "has founded" becomes "founded". | Status: not_done
- [ ] **Implement underscore collapsing** -- Collapse multiple consecutive underscores to a single underscore. | Status: not_done
- [ ] **Implement leading/trailing underscore trimming** -- Remove leading and trailing underscores from the normalized predicate. | Status: not_done
- [ ] **Write tests for predicate normalization** -- Test lowercase conversion. Test space-to-underscore. Test hyphen-to-underscore ("co-founded" -> "co_founded"). Test auxiliary verb stripping ("Was born in" -> "born_in", "has founded" -> "founded", "is_a" stays "is_a"). Test underscore collapsing. Test edge cases (empty string, single word). | Status: not_done

### 2.3 Within-Passage Deduplication

- [ ] **Implement within-passage triple deduplication** -- After normalization, if the same triple (same subject, predicate, object) appears multiple times within a single passage, keep the one with the higher confidence score. | Status: not_done
- [ ] **Write tests for within-passage deduplication** -- Test duplicate triples with different confidence scores. Test triples that differ after normalization but match post-normalization. | Status: not_done

### 2.4 Entity Resolution

- [ ] **Implement resolution orchestrator** -- In `src/resolve/resolver.ts`, run all four resolution phases in sequence on the complete entity set. Apply configurable phase toggles from `options.resolution`. Return merged entity list and updated triples. | Status: not_done
- [x] **Implement Phase 1: Alias-based merging** -- In `src/resolve/alias-match.ts`, for each entity, check if any of its aliases exactly match the canonical name of another entity. If so, merge them. | Status: done
- [x] **Implement Phase 2: Case-insensitive name matching** -- In `src/resolve/case-match.ts`, after Phase 1, find entities with identical names after lowercasing and whitespace normalization. Merge duplicates. | Status: done
- [x] **Implement Phase 3: Substring containment matching** -- In `src/resolve/substring-match.ts`, for entities of the same type, check if one entity's name is a substring of another's. Only merge when the shorter name has >= `minNameLength` (default: 3) characters and types match. | Status: done
- [ ] **Implement Phase 4: Abbreviation matching** -- In `src/resolve/abbreviation-match.ts`, detect all-uppercase entity names and check if they match the initials of multi-word entity names. Handle patterns like "U.S." matching "United States". | Status: not_done
- [ ] **Implement merge semantics** -- When merging entity B into entity A: keep the longer name as canonical; add B's name to A's aliases; combine all aliases; merge properties (A takes precedence); update all triples referencing B to reference A; remove B from the entity set. | Status: not_done
- [ ] **Implement configurable resolution** -- Support `resolution.enabled` (default: true), and per-phase toggles: `aliasMatch`, `caseInsensitive`, `substringMatch`, `abbreviationMatch`, `minNameLength`. Setting `resolution.enabled: false` disables all phases. | Status: not_done
- [ ] **Implement entityResolver hook** -- When `options.entityResolver` is provided, call it instead of the built-in resolution. Pass all entities, receive back the resolution result with merge map and deduplicated entities. | Status: not_done
- [x] **Write tests for alias-based merging** -- Test exact alias match merging. Test that non-matching aliases are not merged. Test merging with multiple aliases. | Status: done
- [x] **Write tests for case-insensitive matching** -- Test "United Nations" and "united nations" merge. Test that different names are not merged. | Status: done
- [ ] **Write tests for substring containment** -- Test "Albert Einstein" and "Einstein" merge when both are Person. Test that different types are NOT merged ("Princeton" Location vs "Princeton University" Organization). Test minNameLength threshold (2-character names not merged). | Status: not_done
- [ ] **Write tests for abbreviation matching** -- Test "NASA" matches "National Aeronautics and Space Administration". Test "UN" matches "United Nations". Test "U.S." matches "United States". Test non-abbreviations are not matched. | Status: not_done
- [ ] **Write tests for merge semantics** -- Verify canonical name is the longer one. Verify aliases are combined. Verify properties are merged with precedence. Verify all triples referencing merged entity are updated. | Status: not_done
- [ ] **Write tests for resolution configuration** -- Test disabling all resolution. Test toggling individual phases. | Status: not_done
- [ ] **Write tests for entityResolver hook** -- Test that custom resolver is called instead of built-in. Test that its output is applied correctly. | Status: not_done

### 2.5 Passage Splitter

- [ ] **Implement paragraph-boundary splitting** -- In `src/split/passage-splitter.ts`, split text on double newlines (paragraph boundaries). | Status: not_done
- [x] **Implement sentence-boundary splitting for long paragraphs** -- If a single paragraph exceeds `maxPassageTokens` (default: 1500, estimated at 4 chars per token), further split on sentence boundaries. | Status: done
- [ ] **Implement short paragraph merging** -- Merge adjacent short paragraphs that are below `minPassageTokens` (default: 100) into a single passage. | Status: not_done
- [x] **Implement token estimation** -- Estimate token count at 4 characters per token (simple heuristic as specified). | Status: done
- [ ] **Write tests for passage splitter** -- Test normal paragraph splitting. Test long paragraph sentence splitting. Test short paragraph merging. Test edge cases: empty text, text with only newlines, single paragraph, many tiny paragraphs. Test maxPassageTokens and minPassageTokens configuration. | Status: not_done

### 2.6 buildGraph Function

- [x] **Implement `buildGraph()` function** -- In `src/build-graph.ts`, implement the multi-text extraction pipeline: accept `string | string[]`, split single string into passages (or use array as-is), extract from each passage with concurrency control, normalize, resolve entities, construct graph. | Status: done
- [ ] **Implement passage-level extraction with concurrency** -- Process passages concurrently up to `options.concurrency` limit. Each passage runs the full extract pipeline (entity extraction + relationship extraction). | Status: not_done
- [ ] **Integrate normalization** -- After extraction, apply entity name normalization and predicate normalization to all results. | Status: not_done
- [x] **Integrate entity resolution** -- After normalization, run entity resolution across all passages' entities. Update all triples with resolved entity names. | Status: done
- [x] **Integrate graph construction** -- After resolution, create a `KnowledgeGraph`, add all entities and triples. Return the graph. | Status: done
- [ ] **Support custom splitter** -- When `options.splitter` is provided, use it instead of the built-in passage splitter. | Status: not_done
- [x] **Export `buildGraph()` from index.ts** -- Update `src/index.ts` to export `buildGraph`. | Status: done
- [x] **Write integration tests for `buildGraph()`** -- Test with multiple passages with overlapping entities. Verify entity resolution merges them. Verify resulting graph connectivity. Test single string input (triggers splitting). Test array input (no splitting). Test custom splitter. | Status: done

---

## Phase 3: KnowledgeGraph Class (v0.3.0)

### 3.1 Core Data Structure

- [x] **Implement KnowledgeGraph constructor** -- In `src/graph/knowledge-graph.ts`, initialize the adjacency list as a `Map<string, EntityNode>` and a predicate index as `Map<string, Edge[]>`. | Status: done
- [x] **Implement `addEntity(entity)`** -- Add an entity node to the graph. If entity already exists, merge metadata: update type if existing is `'Concept'` and new is more specific, merge aliases and properties. | Status: done
- [x] **Implement `addTriple(triple)`** -- Add a triple to the graph. Create subject/object entities if they don't exist (type `'Concept'`). Add to subject's outgoing edges and object's incoming edges. Update predicate index. | Status: done
- [x] **Implement `getEntity(name)`** -- Retrieve entity node by name. Case-insensitive lookup. Return `EntityNode | undefined`. | Status: done
- [x] **Implement `getRelationships(entityName, direction?)`** -- Return all triples for an entity, optionally filtered by direction (`'outgoing'`, `'incoming'`, `'both'`; default `'both'`). | Status: done
- [ ] **Implement `removeTriple(subject, predicate, object)`** -- Remove a specific triple. Remove from subject's outgoing, object's incoming, and predicate index. Return `true` if found and removed. | Status: not_done
- [ ] **Implement `removeEntity(name)`** -- Remove an entity and all its associated triples (both incoming and outgoing). Clean up predicate index. Return `true` if found. | Status: not_done
- [x] **Implement `entities()` iterator** -- Return an `IterableIterator<EntityNode>` over all entity nodes. | Status: done
- [x] **Implement `triples()` iterator** -- Return an `IterableIterator<Triple>` over all unique triples (each yielded exactly once). | Status: done
- [x] **Write tests for core graph operations** -- Test addEntity (new, merge, type upgrade). Test addTriple (new entities auto-created, existing entities preserved). Test getEntity (found, not found, case-insensitive). Test getRelationships (outgoing, incoming, both). Test removeTriple (found, not found). Test removeEntity (cascading triple removal). Test iterators. | Status: done

### 3.2 Query Engine

- [x] **Implement `query(subject?, predicate?, object?, options?)`** -- In `src/graph/query.ts`, implement pattern-based triple matching. Treat `'*'`, `undefined`, and `null` as wildcards. Support all 8 wildcard patterns from Section 11. Sort results by confidence (highest first). | Status: done
- [ ] **Implement predicate index for efficient predicate-only queries** -- Maintain a `Map<string, Edge[]>` from predicate to edges. Use it when the query has only a predicate specified (pattern `(*, P, *)`). | Status: not_done
- [ ] **Implement `QueryOptions.filter`** -- Apply caller-provided filter function to matching triples before returning. | Status: not_done
- [ ] **Implement `QueryOptions.limit`** -- Limit the number of returned results. | Status: not_done
- [x] **Write tests for query engine** -- Test all 8 wildcard patterns: (S,P,O), (S,P,*), (S,*,O), (S,*,*), (*,P,O), (*,P,*), (*,*,O), (*,*,*). Test sorting by confidence. Test filter function. Test limit. Test empty results. Test case-insensitive matching. | Status: done

### 3.3 Path Finding

- [x] **Implement `findPath(from, to, options?)`** -- In `src/graph/path.ts`, implement BFS shortest path between two entities. Support `maxDepth` (default: 10) and `directed` (default: true). Return array of triples forming the path, or `null` if no path exists. Return empty array if `from === to`. | Status: done
- [x] **Implement directed mode** -- Follow edges in their natural direction only (subject -> object). | Status: done
- [ ] **Implement undirected mode** -- When `directed: false`, traverse edges in both directions (subject -> object and object -> subject). | Status: not_done
- [x] **Write tests for path finding** -- Test shortest path in a simple graph. Test directed vs undirected mode. Test maxDepth cutoff. Test disconnected entities (return null). Test from === to (return empty). Test multi-hop paths. | Status: done

### 3.4 Neighbors and Subgraph

- [x] **Implement `getNeighbors(entityName, depth?)`** -- In `src/graph/subgraph.ts` (or knowledge-graph.ts), use BFS to find all entities within N hops of the given entity. Default depth: 1. Return array of `EntityNode`. | Status: done
- [ ] **Implement `getSubgraph(entityName, depth?)`** -- Extract a new `KnowledgeGraph` containing all entities within N hops and all triples between them. Default depth: 1. Return a new `KnowledgeGraph` instance. | Status: not_done
- [x] **Write tests for neighbors and subgraph** -- Test 1-hop and 2-hop neighbors. Test subgraph contains correct entities and triples. Test subgraph is a new independent graph instance. Test entity not found. Test depth=0 (only the entity itself). | Status: done

### 3.5 Graph Merging

- [x] **Implement `merge(other)`** -- Add all entities and triples from `other` into `this` graph. Merge duplicate entities (same name) using merge semantics. Deduplicate triples (same S,P,O): keep higher confidence. | Status: done
- [x] **Write tests for graph merging** -- Test merging two disjoint graphs. Test merging with overlapping entities. Test duplicate triple deduplication (higher confidence kept). Test that the source graph is not modified. | Status: done

### 3.6 Graph Statistics

- [x] **Implement `stats()`** -- In `src/graph/stats.ts`, compute: `nodeCount`, `edgeCount` (maintained incrementally), `connectedComponents` (BFS/DFS on undirected view), `avgDegree`, `maxDegree`, `mostConnected` (entity with highest degree), `entityTypes` (count per type), `predicates` (count per predicate). | Status: done
- [ ] **Implement connected components computation** -- Use BFS/DFS treating the graph as undirected. Count the number of connected components. | Status: not_done
- [x] **Write tests for graph statistics** -- Test stats on a known graph. Verify node/edge counts. Verify connected components count. Verify degree metrics. Verify type and predicate distributions. Test empty graph stats. Test single-node graph stats. | Status: done

### 3.7 Type-Based Queries

- [x] **Implement `getEntitiesByType(type)`** -- Maintain a type index (`Map<string, Set<string>>`) updated incrementally as entities are added. Return all `EntityNode` objects of the given type. | Status: done
- [x] **Write tests for type-based queries** -- Test filtering by each built-in type. Test empty result for unused type. Test with custom types. | Status: done

### 3.8 Graph Edge Case Tests

- [ ] **Write edge case tests for KnowledgeGraph** -- Test empty graph (all operations return empty/null/0). Test single-node graph (no edges). Test self-referential triple (subject === object). Test duplicate triples added to graph. Test graph with disconnected components. | Status: not_done

---

## Phase 4: Serialization and Adapters (v0.4.0)

### 4.1 JSON Serialization

- [x] **Implement `toJSON()`** -- In `src/serialize/json.ts`, export the graph as a `GraphJSON` object with `entities` array, `triples` array, and `metadata` (createdAt ISO timestamp, version from package.json, entityCount, tripleCount). | Status: done
- [x] **Implement `KnowledgeGraph.fromJSON()`** -- Static method accepting a `GraphJSON` object or JSON string. Parse if string. Construct a `KnowledgeGraph` by adding all entities and triples. | Status: done
- [x] **Write JSON round-trip test** -- Build a graph, export to JSON, import from JSON, verify the reconstructed graph is identical (same entities, triples, metadata). Test both object and string input. | Status: done

### 4.2 GraphML Export

- [ ] **Implement `toGraphML()`** -- In `src/serialize/graphml.ts`, generate a well-formed GraphML XML document. Map entities to `<node>` elements with `id`, `name`, `type`, `aliases` attributes. Map triples to `<edge>` elements with `source`, `target`, `predicate`, `confidence` attributes. Include GraphML key definitions for custom attributes. | Status: not_done
- [ ] **Write tests for GraphML export** -- Verify output is well-formed XML. Verify node and edge counts match. Verify attribute values. Test with special characters in entity names (XML escaping). | Status: not_done

### 4.3 CSV/TSV Export

- [ ] **Implement `toCSV()`** -- In `src/serialize/csv.ts`, export all triples as comma-separated values. First row is header: `subject,predicate,object,confidence,source_text`. Quote values containing the delimiter. Escape newlines within values. | Status: not_done
- [ ] **Implement `toTSV()`** -- Same as CSV but tab-separated. | Status: not_done
- [ ] **Write tests for CSV/TSV export** -- Verify header row. Verify correct number of data rows. Verify quoting of values with commas. Verify newline escaping. Verify tab separation in TSV. Test with empty graph (header only). | Status: not_done

### 4.4 Cypher Export

- [ ] **Implement `toCypher()`** -- In `src/serialize/cypher.ts`, generate Neo4j Cypher `CREATE` statements. Create nodes with entity type as label and properties (name, aliases). Create relationships with predicate as UPPER_SNAKE_CASE type and properties (confidence, sourceText). Assign variable names (n0, n1, ...) for referencing in relationship creation. | Status: not_done
- [ ] **Write tests for Cypher export** -- Verify output contains CREATE statements for all nodes and edges. Verify label formatting (entity type). Verify relationship type is UPPER_SNAKE_CASE. Verify property formatting. Test with special characters in strings (Cypher escaping). | Status: not_done

### 4.5 LLM Adapters

- [ ] **Implement OpenAI adapter** -- In `src/adapters/openai.ts`, create `adapters.openai(client, options)` that accepts an OpenAI client instance and returns an `LLMMessageFunction`. The adapter converts `LLMMessage[]` to the OpenAI chat completions format. Accept model and temperature options. | Status: not_done
- [ ] **Implement Anthropic adapter** -- In `src/adapters/anthropic.ts`, create `adapters.anthropic(client, options)` that accepts an Anthropic client instance and returns an `LLMMessageFunction`. The adapter converts `LLMMessage[]` to the Anthropic messages format. Accept model and maxTokens options. | Status: not_done
- [ ] **Export adapters from index** -- In `src/adapters/index.ts`, export both adapter factories. Export from `src/index.ts` as `adapters`. | Status: not_done
- [ ] **Write tests for adapters** -- Test that adapters call the underlying client with correct format. Use mock client objects. Verify message format conversion. | Status: not_done

### 4.6 Factory Function

- [x] **Implement `createExtractor(config)`** -- In `src/factory.ts`, create a factory that returns an `Extractor` object with `extract()` and `buildGraph()` methods. Store config. Merge per-call overrides with factory config (per-call takes precedence). | Status: done
- [x] **Implement configuration precedence** -- Per-call overrides > factory config > built-in defaults. Deep merge for nested objects like `resolution`. | Status: done
- [x] **Export `createExtractor()` from index.ts** -- Update `src/index.ts` to export `createExtractor`. | Status: done
- [ ] **Write tests for createExtractor** -- Test that factory-level options are applied. Test that per-call overrides take precedence. Test that the returned extractor's extract() and buildGraph() methods work correctly with mock LLM. | Status: not_done

---

## Phase 5: Configuration, Integration, and Polish (v1.0.0)

### 5.1 Custom Prompt Templates

- [ ] **Implement custom prompt template support** -- When `options.promptTemplates.entityExtraction` is provided, use its `system` and/or `user` function in place of built-in templates. Same for `relationshipExtraction`. Allow partial overrides (only system, only user, or both). | Status: not_done
- [ ] **Implement custom `outputParser` support** -- When custom prompt templates produce non-standard output, support a custom parser (if specified in the spec -- verify and implement). | Status: not_done
- [ ] **Write tests for custom prompt templates** -- Test custom system message replaces built-in. Test custom user function is called with passage text. Test partial override (only system, only user). | Status: not_done

### 5.2 Structured Output Mode

- [ ] **Wire `structuredOutput` through extraction pipeline** -- When true, skip heuristic JSON fixes in parser. Throw `ExtractionError` with code `PARSE_FAILED` on parse failure (no retry). | Status: not_done
- [ ] **Write tests for structured output mode** -- Test that valid JSON parses correctly. Test that invalid JSON throws immediately without retry. | Status: not_done

### 5.3 Confidence Filtering

- [x] **Wire `minConfidence` through extraction pipeline** -- After triple validation, filter out triples below the threshold. Default: 0.0 (include all). | Status: done
- [ ] **Write tests for confidence filtering** -- Test that triples below threshold are excluded. Test threshold of 0.0 includes all. Test threshold of 1.0 includes only perfect confidence. | Status: not_done

### 5.4 Filtered and Limited Queries

- [ ] **Wire `QueryOptions.filter` in query()** -- Apply the filter function to each matching triple before including in results. | Status: not_done
- [ ] **Wire `QueryOptions.limit` in query()** -- After filtering and sorting, return only the first `limit` results. | Status: not_done
- [ ] **Write tests for filtered and limited queries** -- Test filter by confidence threshold. Test filter by sourcePassage. Test limit. Test filter + limit combined. | Status: not_done

### 5.5 Full Public API Exports

- [ ] **Finalize `src/index.ts` exports** -- Export all public symbols: `extract`, `buildGraph`, `createExtractor`, `KnowledgeGraph`, `adapters`, `ExtractionError`, and all public TypeScript types/interfaces. | Status: not_done
- [ ] **Verify TypeScript declarations** -- Run `tsc` and confirm `dist/index.d.ts` exports all public types correctly. Verify consumers can import types without errors. | Status: not_done

### 5.6 Edge Case Tests (Extraction Pipeline)

- [ ] **Test empty text input** -- Verify `extract("")` throws `ExtractionError` with code `EMPTY_TEXT`. | Status: not_done
- [ ] **Test text with no entities** -- Provide text like "The weather was nice today." with mock LLM returning empty arrays. Verify result has empty entities and triples. | Status: not_done
- [ ] **Test very long text** -- Provide text exceeding `maxPassageTokens`. Verify splitting occurs and multiple passages are processed. | Status: not_done
- [ ] **Test entities with special characters** -- Names with accents, apostrophes, hyphens: "O'Brien", "Hewlett-Packard", "Sao Paulo". Verify normalization preserves them correctly. | Status: not_done
- [ ] **Test heavily nested relationships** -- "A, who founded B, which acquired C, that operates in D". Verify multi-hop decomposition produces correct triples. | Status: not_done
- [ ] **Test duplicate triples within a passage** -- Verify deduplication keeps the higher confidence one. | Status: not_done
- [ ] **Test self-referential triple** -- Subject equals object. Verify it is handled gracefully (added to graph without error). | Status: not_done
- [ ] **Test graph with no edges** -- Entities extracted but no relationships. Verify graph has nodes but no edges. | Status: not_done
- [ ] **Test graph with single entity** -- Verify graph operations work on a single-node graph. | Status: not_done
- [ ] **Test LLM failure** -- Mock LLM that throws an error. Verify `ExtractionError` with code `LLM_FAILED` is thrown. | Status: not_done
- [ ] **Test determinism with mock LLM** -- Same input + same mock LLM = identical output. Run twice and compare. | Status: not_done

### 5.7 Integration Tests

- [ ] **Write end-to-end extraction test** -- Full pipeline: text -> extract -> entities + triples. Use mock LLM with realistic predefined responses. Verify all fields of `ExtractionResult`. | Status: not_done
- [ ] **Write end-to-end buildGraph test** -- Multiple texts -> buildGraph -> KnowledgeGraph. Verify entity resolution across passages. Run queries, findPath, getSubgraph on the result. | Status: not_done
- [ ] **Write constrained predicates integration test** -- Provide predicate list, verify prompt contains constraints, verify mock LLM response with constrained predicates is parsed correctly. | Status: not_done
- [ ] **Write custom entity types integration test** -- Provide custom types, verify they appear in prompt, verify mock LLM response with custom types is parsed correctly. | Status: not_done
- [ ] **Write error handling integration test** -- Mock LLM returning invalid JSON. Verify retry mechanism fires. Verify corrective prompt is sent. Mock LLM that fails completely. Verify ExtractionError. | Status: not_done
- [ ] **Write serialization round-trip integration test** -- Build graph from extraction, export to JSON, import, verify identical. Export to GraphML, CSV, TSV, Cypher and verify well-formedness. | Status: not_done

### 5.8 Test Fixtures

- [ ] **Create mock LLM fixture** -- In `src/__tests__/fixtures/mock-llm.ts`, implement a deterministic mock LLM function that returns predefined JSON responses based on input patterns. Support configurable responses for different passages. | Status: not_done
- [ ] **Create sample passages** -- In `src/__tests__/fixtures/passages/`, create sample text passages for testing (Einstein biography, company description, biomedical text, etc.). | Status: not_done
- [ ] **Create expected results** -- In `src/__tests__/fixtures/expected/`, create expected extraction results matching the mock LLM responses and sample passages. | Status: not_done

### 5.9 Documentation

- [ ] **Write README.md** -- Create comprehensive README with: package description, installation instructions, quick start example, API reference for `extract()`, `buildGraph()`, `createExtractor()`, `KnowledgeGraph` class methods, configuration options table, serialization examples, adapter usage, integration with ecosystem packages, and license. | Status: not_done
- [ ] **Add JSDoc comments to all public APIs** -- Document every exported function, class, method, and type with JSDoc comments including parameter descriptions, return types, examples, and throws documentation. | Status: not_done

### 5.10 Build and Publish Preparation

- [ ] **Verify full build** -- Run `npm run build` and confirm clean compilation with no errors or warnings. Verify `dist/` output includes all `.js`, `.d.ts`, and `.d.ts.map` files. | Status: not_done
- [ ] **Verify full test suite** -- Run `npm run test` and confirm all tests pass. | Status: not_done
- [ ] **Verify lint** -- Run `npm run lint` and confirm no lint errors. | Status: not_done
- [ ] **Verify package.json fields** -- Confirm `main`, `types`, `files`, `engines`, `keywords`, `description`, `author`, and `license` are all set correctly. Add relevant keywords. | Status: not_done
- [ ] **Version bump for release** -- Bump version according to semver for each release milestone (0.1.0, 0.2.0, 0.3.0, 0.4.0, 1.0.0). | Status: not_done
