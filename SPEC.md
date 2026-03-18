# kg-extract -- Specification

## 1. Overview

`kg-extract` is an LLM-powered knowledge graph extraction library that takes unstructured text, prompts a language model to identify entities and relationships, normalizes the results into structured triples, and assembles them into a queryable in-memory knowledge graph. It answers the question that every developer building structured knowledge systems in JavaScript needs answered: "Given this text, what are the entities and how are they related?" -- and it answers it without requiring Python, Neo4j, or any external graph database.

The gap this package fills is specific and well-defined. Knowledge graph construction from unstructured text is a well-studied problem in NLP, and multiple production-grade tools exist -- but exclusively in Python. LangChain provides a `LLMGraphTransformer` that extracts nodes and relationships from documents and loads them into Neo4j. The `kg-gen` Python package by WhyHow AI uses LLMs to extract triples from text with configurable entity types and relationship constraints. Microsoft's GraphRAG builds a hierarchical community-based knowledge graph from document corpora using iterative LLM summarization. `txtai` includes a knowledge graph module that combines embeddings with graph structure. The `rebel` model from Babelscape performs end-to-end relation extraction from text using a fine-tuned BART model. Every one of these tools is Python-only. On the npm side, `graphology` provides a general-purpose graph data structure, `cytoscape` provides graph visualization, and `neo4j-driver` provides a Neo4j client -- but none of them extract entities and relationships from text. There is no npm package that takes a paragraph of English text and returns a set of `(subject, predicate, object)` triples. `kg-extract` fills this gap.

`kg-extract` provides a TypeScript/JavaScript API for programmatic use. The API centers on two operations: `extract(text, options?)` which extracts entities and triples from a text passage using LLM prompts, and `buildGraph(texts, options?)` which processes multiple texts and assembles the results into a `KnowledgeGraph` instance with query, traversal, and serialization capabilities. The LLM interface is pluggable: callers provide a function with the signature `(prompt: string) => Promise<string>` (or a message-based variant), and `kg-extract` handles prompt construction, output parsing, validation, and error recovery. Built-in prompt templates are optimized for entity and relationship extraction, but callers can supply custom templates. The in-memory `KnowledgeGraph` class stores entities as nodes and relationships as edges in an adjacency list, supports pattern-based triple queries with wildcards, BFS/DFS path finding, subgraph extraction, and exports to JSON, GraphML, CSV triples, and Cypher statements.

The package has zero mandatory runtime dependencies. All prompt templates, output parsers, graph data structures, traversal algorithms, and serialization formats are implemented in pure TypeScript. The LLM itself is the caller's responsibility -- `kg-extract` is LLM-agnostic and works with any model that can produce structured text output (OpenAI, Anthropic, Google, Cohere, Ollama, any local model).

---

## 2. Goals and Non-Goals

### Goals

- Provide an `extract(text, options?)` function that prompts an LLM to identify entities and relationships in a text passage and returns a structured `ExtractionResult` containing typed entities and relationship triples with confidence scores and source provenance.
- Provide a `buildGraph(texts, options?)` function that processes one or more text passages, extracts entities and triples from each, resolves duplicate entities across passages, and assembles all triples into a queryable in-memory `KnowledgeGraph`.
- Provide a `createExtractor(config)` factory function that creates a pre-configured extractor instance for repeated use, avoiding repeated option parsing and LLM adapter setup.
- Implement entity extraction using LLM prompts that identify entities with their names, types (Person, Organization, Location, Date, Event, Concept, Product, or custom types), and optional aliases.
- Implement relationship extraction using LLM prompts that identify directed relationships between entities as `(subject, predicate, object)` triples with optional confidence scores and source text evidence.
- Handle coreference resolution in LLM prompts: instruct the LLM to resolve pronouns ("he", "she", "it", "they") and definite descriptions ("the company", "the scientist") to their named referents before emitting triples.
- Normalize extracted triples: canonicalize entity names (consistent casing, whitespace), normalize predicate strings to a consistent format (lowercase, underscore-separated), and merge duplicate entities that the LLM emitted with slightly different surface forms.
- Provide a lightweight in-memory `KnowledgeGraph` class with adjacency list representation, supporting: `addTriple`, `addEntity`, `getEntity`, `getRelationships`, `query` (pattern-based triple matching with wildcards), `findPath` (BFS shortest path between entities), `getNeighbors`, `getSubgraph` (N-hop neighborhood extraction), `merge` (combine two graphs), `removeTriple`, `removeEntity`, and graph statistics (node count, edge count, connected components, degree distribution).
- Support pluggable LLM interfaces: accept either a simple `(prompt: string) => Promise<string>` function or a message-based `(messages: Message[]) => Promise<string>` function, with built-in adapters for common patterns (OpenAI chat completions, Anthropic messages).
- Provide built-in prompt templates for entity extraction and relationship extraction, designed for high-quality structured output. Support custom prompt templates for domain-specific extraction.
- Parse and validate LLM output robustly: handle JSON output, markdown-wrapped JSON, partial JSON, and common LLM formatting quirks. Retry on parse failure with a corrective prompt.
- Serialize and deserialize knowledge graphs: JSON export/import (lossless round-trip), GraphML export (standard graph interchange format), CSV/TSV triple list export, and Cypher statement export (for loading into Neo4j).
- Support extraction from long texts by splitting into passages, extracting from each passage independently, and merging results with cross-passage entity resolution.
- Integrate with `entity-resolve` for advanced entity resolution, `embed-cache` for embedding-based entity similarity, `rag-prompt-builder` for incorporating graph context into RAG prompts, and `chunk-smart` for intelligent text splitting before extraction.
- Zero mandatory runtime dependencies. All algorithms are self-contained TypeScript. The LLM is the caller's responsibility.
- Target Node.js 18 and above.

### Non-Goals

- **Not a graph database.** This package stores the knowledge graph in memory as a JavaScript object. It does not persist graphs to disk, provide ACID transactions, support concurrent writes, or implement graph query languages like Cypher, SPARQL, or Gremlin. For persistent graph storage, export the graph to Neo4j using the Cypher export, or serialize to JSON and store in any database.
- **Not an NER model.** This package does not run a Named Entity Recognition model locally. It delegates entity extraction to an LLM via prompts. Traditional NER (spaCy, Stanford NER, NLTK) uses trained statistical or neural models that run locally without API calls. `kg-extract` relies on an LLM, which requires either API access or a locally running model. For offline NER without LLM calls, use a dedicated NER library.
- **Not an embedding generator.** This package does not generate embeddings for entities or relationships. Entity similarity for resolution is handled by string matching heuristics (with an optional hook for embedding-based similarity via `entity-resolve` or `embed-cache`). For embedding generation, use `embed-cache`.
- **Not a visualization tool.** This package does not render graphs visually. It exports graph data in standard formats (JSON, GraphML) that can be consumed by visualization tools like `cytoscape.js`, `d3-force`, `vis-network`, or Gephi. For visualization, pipe the export into any graph rendering library.
- **Not a reasoning engine.** This package extracts facts as stated in the text. It does not perform logical inference, ontology reasoning, transitive closure computation, or rule-based deduction over the graph. The graph contains what the text explicitly says, not what can be inferred from it.
- **Not a full ontology manager.** This package supports optional predicate constraints (restricting which predicates are allowed) but does not implement OWL ontologies, RDF schemas, class hierarchies, or property domains and ranges. For formal ontology management, use dedicated tools.
- **Not a document processor.** This package operates on plain text strings. It does not parse PDFs, Word documents, HTML, or other document formats. Convert documents to text before passing to `kg-extract`. For document parsing, use appropriate libraries upstream.
- **Not a streaming processor.** Extraction is batch-oriented: pass a text (or array of texts), get results back. Real-time incremental extraction from streaming text is out of scope.

---

## 3. Target Users and Use Cases

### Knowledge Base Builders

Developers constructing structured knowledge bases from unstructured document corpora. They have a collection of documents (articles, reports, manuals, wiki pages) and need to extract the entities mentioned in them and the relationships between those entities into a structured format that can be queried, browsed, and reasoned over. They call `buildGraph(texts)` to process all documents and get a `KnowledgeGraph` they can query with patterns like `graph.query("Albert Einstein", "*", "*")` to find all relationships involving Einstein, or `graph.query("*", "founded", "*")` to find all founding relationships.

### GraphRAG Pipeline Developers

Developers building Graph-based Retrieval-Augmented Generation (GraphRAG) pipelines where the retrieval step uses a knowledge graph rather than (or in addition to) vector similarity. Microsoft's GraphRAG paper demonstrated that structuring knowledge as a graph and using community detection + summarization produces better answers for global sensemaking queries. `kg-extract` provides the extraction layer: convert documents into a knowledge graph, then use the graph for structured retrieval. The extracted graph can be queried for relevant subgraphs, which are then included in the LLM prompt via `rag-prompt-builder`.

### Document Analysis and Intelligence

Analysts examining large document sets (legal filings, research papers, news articles, intelligence reports) who need to understand the entity landscape and relationship structure. "Who is mentioned in these documents? How are they connected? What organizations appear most frequently? What events are linked to which people?" The knowledge graph provides a structured view of the document corpus that is impossible to obtain from keyword search or even vector similarity -- it captures the typed, directional relationships between entities.

### Question Answering with Structured Context

Developers building QA systems that augment LLM responses with structured knowledge. Instead of passing raw text chunks as context, they extract a knowledge graph from the corpus and pass relevant subgraphs as structured context. The LLM receives triples like `("CRISPR", "invented_by", "Jennifer Doudna"), ("Jennifer Doudna", "won", "Nobel Prize in Chemistry 2020")` rather than a wall of text, enabling more precise and faithful answers.

### Entity Relationship Mapping

Product teams that need to map relationships in specific domains: investment relationships between companies and investors, authorship relationships between researchers and papers, supply chain relationships between manufacturers and suppliers, character relationships in narrative text. The extraction pipeline can be configured with domain-specific entity types and predicate constraints to produce clean, schema-conforming graphs.

### Integration with npm-master Ecosystem

Developers using other packages in the npm-master monorepo: `chunk-smart` for splitting documents before extraction, `entity-resolve` for advanced entity deduplication, `embed-cache` for caching embeddings used in entity resolution, `rag-prompt-builder` for composing prompts with graph context, and `fusion-rank` for fusing graph-based and vector-based retrieval results. `kg-extract` is the structured knowledge extraction layer that converts unstructured text into the graph structures these tools operate on.

---

## 4. Core Concepts

### Entity

An entity is a named thing mentioned in the text. Entities are the nodes of the knowledge graph. Each entity has a canonical name (the primary identifier), a type (Person, Organization, Location, etc.), and optionally a set of aliases (alternative names that refer to the same entity). For example, the text "Albert Einstein was born in Ulm" contains two entities: `{ name: "Albert Einstein", type: "Person" }` and `{ name: "Ulm", type: "Location" }`.

Entities are identified by their canonical name (case-insensitive). Two entities with the same canonical name are the same entity. The entity resolution pipeline (Section 9) handles cases where the LLM extracts the same entity under different names ("Albert Einstein" vs "Einstein" vs "A. Einstein").

### Entity Type

An entity type classifies the entity into a semantic category. The built-in entity types cover the most common categories in general text:

| Type | Description | Examples |
|------|-------------|----------|
| `Person` | A named individual | Albert Einstein, Marie Curie, Elon Musk |
| `Organization` | A named organization, company, institution, or group | NASA, Google, United Nations, MIT |
| `Location` | A named geographic location | Ulm, Germany, Pacific Ocean, Silicon Valley |
| `Date` | A specific date, time period, or temporal reference | 1879, March 14 1879, 20th century |
| `Event` | A named event or occurrence | World War II, Nobel Prize ceremony, IPO |
| `Concept` | An abstract concept, theory, field, or idea | General relativity, machine learning, democracy |
| `Product` | A named product, technology, or artifact | iPhone, CRISPR, TCP/IP |

Callers can define additional custom types via the `entityTypes` option. When custom types are provided, they are added to (not replacing) the built-in types. The LLM is instructed to use the provided type taxonomy when classifying entities.

### Triple

A triple is the fundamental unit of knowledge in the graph. A triple represents a single directed relationship between two entities. It has three components:

- **Subject**: The entity that the relationship originates from.
- **Predicate**: The type of relationship (a verb or verb phrase).
- **Object**: The entity that the relationship points to.

For example, the sentence "Albert Einstein was born in Ulm" produces the triple `("Albert Einstein", "born_in", "Ulm")`. The sentence "Einstein won the Nobel Prize in Physics in 1921" produces `("Albert Einstein", "won", "Nobel Prize in Physics")` and potentially `("Albert Einstein", "won_in_year", "1921")` or a triple with properties.

Triples are directed: `("Einstein", "born_in", "Ulm")` means Einstein was born in Ulm, not that Ulm was born in Einstein. The direction is determined by the natural reading of the relationship.

### Predicate

A predicate is the label on a directed edge in the knowledge graph. It describes the type of relationship between the subject and object entities. Predicates are normalized to a consistent format: lowercase, whitespace replaced with underscores, leading and trailing whitespace stripped. "Was born in" becomes `born_in`. "CEO of" becomes `ceo_of`. "Is a" becomes `is_a`.

Predicates can be open (any predicate the LLM produces is accepted) or constrained (only predicates from a provided list are allowed). Open predicates are the default and are appropriate for exploratory extraction. Constrained predicates are appropriate when the caller has a defined ontology or schema.

### Knowledge Graph

A knowledge graph is a directed labeled multigraph where nodes are entities and edges are relationships (triples). "Directed" because each edge has a direction (subject to object). "Labeled" because each node has a type and each edge has a predicate. "Multigraph" because two entities can have multiple relationships between them (Einstein `born_in` Ulm and Einstein `lived_in` Ulm are two distinct edges between the same pair of nodes).

The knowledge graph is the primary output of the `buildGraph()` function and the primary data structure that callers interact with for queries, traversal, and export.

### Extraction Pipeline

The extraction pipeline is the sequence of steps that transforms unstructured text into a knowledge graph:

1. **Text preprocessing**: Split long texts into passages.
2. **Entity extraction**: LLM prompt to identify entities with types.
3. **Relationship extraction**: LLM prompt to identify triples between entities.
4. **Triple normalization**: Clean entity names, normalize predicates.
5. **Entity resolution**: Merge duplicate entities across passages.
6. **Graph construction**: Add normalized triples to the in-memory graph.

Each step is described in detail in subsequent sections.

### Passage

A passage is a segment of text that is processed as a single unit by the extraction pipeline. Long texts are split into passages before extraction because LLM context windows have limits and because extraction quality degrades for very long inputs (the LLM may miss entities mentioned far apart in the text). Passages are typically 500-2000 tokens, corresponding to 1-4 paragraphs. The `chunk-smart` package can be used for intelligent passage splitting, or a simple paragraph-boundary splitter is built in.

### Confidence Score

An optional numeric score (0.0 to 1.0) attached to a triple indicating how confident the extraction is. The LLM is instructed to provide confidence scores in its output, reflecting how explicitly the relationship is stated in the text. A triple extracted from "Einstein was born in Ulm" has high confidence (the text explicitly states the relationship). A triple extracted from "Einstein, who spent time in Switzerland" as `("Einstein", "lived_in", "Switzerland")` has lower confidence (the text implies but does not explicitly state the relationship). Confidence scores are optional -- when the LLM does not provide them, they default to 1.0.

### Source Provenance

Each extracted triple carries a reference to the source text it was extracted from. This includes the passage text (or a portion of it), the passage index (which passage in the input), and optionally character offsets within the passage. Source provenance enables traceability: for any triple in the graph, the caller can determine which text it came from.

---

## 5. Extraction Pipeline

### Overview

The extraction pipeline transforms unstructured text into a structured knowledge graph through a sequence of six steps. Each step builds on the output of the previous step. The pipeline is designed to be robust to the variability of LLM output -- different LLMs (and different runs of the same LLM) produce different formatting, entity naming, and relationship phrasing. Normalization, validation, and resolution steps compensate for this variability.

### Pipeline Diagram

```
                    ┌─────────────────┐
                    │  Input Text(s)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Step 1: Text   │
                    │  Preprocessing  │
                    │  (passage split)│
                    └────────┬────────┘
                             │
               ┌─────────────▼─────────────┐
               │  Step 2: Entity Extraction │
               │  (LLM prompt per passage)  │
               └─────────────┬─────────────┘
                             │
            ┌────────────────▼────────────────┐
            │  Step 3: Relationship Extraction │
            │  (LLM prompt per passage)        │
            └────────────────┬────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Step 4: Triple Normalization │
              │  (name cleaning, predicate   │
              │   normalization)             │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Step 5: Entity Resolution   │
              │  (merge duplicates)          │
              └──────────────┬──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Step 6: Graph Construction  │
              │  (assemble KnowledgeGraph)   │
              └──────────────┬──────────────┘
                             │
                    ┌────────▼────────┐
                    │ KnowledgeGraph  │
                    └─────────────────┘
```

### Step 1: Text Preprocessing

Long texts are split into passages before extraction. This is necessary because (a) LLM context windows have finite capacity, (b) extraction quality degrades for long inputs -- the LLM loses track of entities mentioned far from each other, and (c) smaller passages allow concurrent extraction calls for throughput.

**Built-in passage splitter**: Splits on double newlines (paragraph boundaries). If a paragraph exceeds `maxPassageTokens` (default: 1500 tokens, estimated at 4 characters per token), it is further split on sentence boundaries. Adjacent short paragraphs (below `minPassageTokens`, default: 100 tokens) are merged into a single passage. The goal is passages of 500-1500 tokens -- long enough for the LLM to understand context, short enough for focused extraction.

**External splitter hook**: Callers can provide a custom `splitter` function or use `chunk-smart` for semantically aware splitting:

```typescript
import { chunk } from 'chunk-smart';
import { buildGraph } from 'kg-extract';

const passages = chunk(longDocument, { maxChunkSize: 1500 });
const graph = await buildGraph(passages.map(p => p.content), { llm });
```

When the input to `buildGraph` is an array of strings, each string is treated as a separate passage (no further splitting is applied). When the input is a single string, the built-in splitter is applied.

### Step 2: Entity Extraction

For each passage, the LLM is prompted to identify all entities mentioned in the text. The prompt instructs the LLM to:

1. Read the passage carefully.
2. Identify every named entity (people, organizations, locations, dates, events, concepts, products).
3. For each entity, provide: the canonical name, the entity type, and any aliases used in the text.
4. Resolve coreferences: if the text says "he" and it refers to "Albert Einstein", use "Albert Einstein" as the entity name.
5. Return the result as a JSON array.

The entity extraction prompt is detailed in Section 6.

**Output**: An array of `Entity` objects for each passage:

```typescript
interface Entity {
  name: string;        // Canonical name: "Albert Einstein"
  type: EntityType;    // "Person"
  aliases?: string[];  // ["Einstein", "A. Einstein"]
}
```

### Step 3: Relationship Extraction

For each passage, the LLM is prompted to identify all relationships between the entities extracted in Step 2. The prompt provides the extracted entities as context and instructs the LLM to:

1. Read the passage again.
2. Identify every relationship between any two entities from the provided entity list.
3. For each relationship, provide: the subject entity name, the predicate (relationship type), the object entity name, an optional confidence score, and the source sentence.
4. Extract both explicit relationships ("Einstein was born in Ulm") and implicit relationships ("Einstein, the German-born physicist" implies `born_in Germany` and `occupation physicist`).
5. Decompose multi-hop statements: "Einstein worked at the Institute for Advanced Study in Princeton" yields two triples: `("Einstein", "worked_at", "Institute for Advanced Study")` and `("Institute for Advanced Study", "located_in", "Princeton")`.
6. Return the result as a JSON array.

The relationship extraction prompt is detailed in Section 7.

**Output**: An array of raw `Triple` objects for each passage:

```typescript
interface RawTriple {
  subject: string;       // "Albert Einstein"
  predicate: string;     // "born in"
  object: string;        // "Ulm"
  confidence?: number;   // 0.95
  sourceText?: string;   // "Albert Einstein was born in Ulm"
}
```

**Combined extraction mode**: By default, entity extraction and relationship extraction are performed in two separate LLM calls per passage. This allows the entity list to inform the relationship extraction step. An alternative `combinedExtraction: true` mode performs both in a single LLM call, which halves the number of LLM calls but may produce lower-quality results for complex passages. The combined mode is faster and cheaper but the two-step mode is more accurate.

### Step 4: Triple Normalization

Raw triples from the LLM are cleaned and standardized:

**Entity name normalization**:
- Trim leading and trailing whitespace.
- Collapse internal whitespace to single spaces.
- Apply title case for Person and Organization types: "albert einstein" becomes "Albert Einstein".
- Preserve original casing for Location, Product, and Concept types (acronyms and proper nouns should not be re-cased).
- Strip leading articles when they are not part of the proper name: "the United Nations" becomes "United Nations", but "The Hague" is preserved.

**Predicate normalization**:
- Convert to lowercase.
- Replace spaces and hyphens with underscores: "Was born in" becomes `was_born_in`, "co-founded" becomes `co_founded`.
- Strip leading auxiliary verbs when redundant: "was born in" becomes `born_in`, "is located in" becomes `located_in`, "has won" becomes `won`. The auxiliary verb stripping uses a fixed list: `was`, `is`, `are`, `were`, `has`, `have`, `had`, `been`.
- Collapse multiple underscores to single underscores.
- Remove trailing prepositions when they are subsumed by the object: `born_in_city` is kept as-is (the preposition is part of the predicate), but `born_in` is the standard form.

**Deduplication within a passage**: If the LLM produces the same triple twice in a single passage (same subject, predicate, and object after normalization), keep the one with the higher confidence score. This is common when the same fact is stated multiple times in a passage.

### Step 5: Entity Resolution

Across multiple passages, the LLM may extract the same entity with different names. "Albert Einstein" in passage 1 and "Einstein" in passage 3 refer to the same entity. Entity resolution merges these into a single node in the graph.

**Built-in resolution strategies** (applied in order):

1. **Exact alias match**: If entity A has alias "Einstein" and entity B has name "Einstein", merge B into A.
2. **Substring containment**: If entity A's name fully contains entity B's name and both have the same type, they are candidates for merging. "Albert Einstein" contains "Einstein" -- merge if types match.
3. **Case-insensitive match**: "united nations" and "United Nations" are the same entity.
4. **Abbreviation match**: "UN" matches "United Nations" when "UN" is a known abbreviation (either provided in aliases or detected as an all-caps string that matches the initials of a multi-word entity name).

**Merge behavior**: When two entities are merged, the entity with the longer name becomes the canonical name (it is more specific). All aliases from both entities are combined. All triples referencing the merged-away entity are updated to reference the surviving canonical entity. Properties from both entities are merged (with the canonical entity's properties taking precedence on conflict).

**Advanced resolution hook**: For callers who need more sophisticated resolution (fuzzy string matching, embedding-based similarity, knowledge base linking), the `entityResolver` option accepts a function:

```typescript
type EntityResolver = (entities: Entity[]) => Promise<EntityResolutionResult>;
```

This function receives all extracted entities across all passages and returns a resolution map indicating which entities should be merged. The `entity-resolve` package provides a production-grade implementation of this interface.

### Step 6: Graph Construction

After normalization and resolution, all triples are added to the in-memory `KnowledgeGraph`:

1. For each unique entity, create a node with its canonical name, type, aliases, and properties.
2. For each triple, create a directed edge from the subject node to the object node with the predicate as the edge label, plus the confidence score and source provenance.
3. Compute graph statistics: node count, edge count, connected component count.

The resulting `KnowledgeGraph` is returned to the caller and can be queried, traversed, serialized, or merged with other graphs.

---

## 6. Entity Extraction

### LLM Prompt Design

The entity extraction prompt is the core of the extraction quality. A poorly designed prompt produces noisy, inconsistent entities. The built-in prompt uses the following structure:

**System message**:

```
You are an expert entity extraction system. Your task is to identify all named
entities in the provided text and classify them by type.

Rules:
1. Extract every named entity mentioned in the text.
2. For each entity, provide:
   - name: The canonical full name of the entity.
   - type: One of: Person, Organization, Location, Date, Event, Concept, Product{customTypes}.
   - aliases: Any alternative names or abbreviations used in the text for this entity.
3. Resolve coreferences: If "he" refers to "Albert Einstein", use "Albert Einstein"
   as the entity name, not "he".
4. Resolve definite descriptions: If "the company" refers to "Google", use "Google".
5. Do not extract generic nouns that are not named entities (e.g., "a scientist",
   "the city" when no specific city is named).
6. Return your response as a JSON array. No other text.

Output format:
[
  { "name": "Entity Name", "type": "EntityType", "aliases": ["alias1", "alias2"] },
  ...
]
```

**User message**:

```
Extract all entities from the following text:

---
{passageText}
---
```

**Few-shot examples** (optional, enabled by default): The prompt includes 2-3 examples of input text and expected entity extraction output, demonstrating the expected format and level of detail. Few-shot examples are configurable via the `examples` option.

### Entity Types

The built-in entity types and their extraction heuristics:

| Type | LLM Instruction | Typical Extraction Cues |
|------|-----------------|------------------------|
| `Person` | Named individuals (first name, last name, title) | Proper nouns preceded by titles (Dr., Mr., Prof.), names with first + last name structure |
| `Organization` | Named companies, institutions, agencies, teams | Names followed by Inc., Corp., Ltd., University, Institute; known organization patterns |
| `Location` | Named geographic places: cities, countries, regions, landmarks | Names preceded by "in", "at", "from"; geographic context |
| `Date` | Specific dates, years, time periods, temporal references | Numeric patterns, month names, temporal prepositions ("in 1905", "during the 1920s") |
| `Event` | Named events, wars, ceremonies, conferences | "War", "Conference", "Summit", "Election", "Revolution" as part of the name |
| `Concept` | Abstract concepts, theories, fields of study, ideas | "Theory of...", "...ism", "...ics", field names |
| `Product` | Named products, technologies, inventions | Product names, technology names, brand names |

### Custom Entity Types

Callers can define additional entity types to guide the LLM toward domain-specific extraction:

```typescript
const result = await extract(text, {
  llm,
  entityTypes: [
    { name: 'Gene', description: 'A specific gene or genetic marker (e.g., BRCA1, TP53)' },
    { name: 'Disease', description: 'A named disease or medical condition (e.g., Alzheimer\'s, diabetes)' },
    { name: 'Drug', description: 'A named pharmaceutical drug (e.g., aspirin, imatinib)' },
  ],
});
```

Custom types are appended to the built-in types in the prompt. The LLM is instructed to classify entities using the full type list (built-in + custom).

### Structured Output Parsing

The LLM is instructed to return a JSON array. However, LLMs do not always produce clean JSON. The parser handles the following cases:

1. **Clean JSON**: The output is a valid JSON array. Parse directly.
2. **Markdown-wrapped JSON**: The output is wrapped in a code fence (` ```json ... ``` `). Strip the code fence and parse.
3. **JSON with preamble**: The output has explanatory text before or after the JSON array. Extract the first `[...]` block and parse.
4. **Single-quoted strings**: Some LLMs use single quotes instead of double quotes. Replace single quotes with double quotes (being careful not to replace apostrophes within strings).
5. **Trailing commas**: Remove trailing commas before `]` or `}`.
6. **Parse failure**: If parsing fails after all heuristic fixes, retry the extraction with a corrective prompt that includes the failed output and asks the LLM to fix the JSON formatting. Maximum 1 retry.

**Validation after parsing**: Each parsed entity is validated:
- `name` must be a non-empty string.
- `type` must be one of the recognized entity types (built-in or custom). If not, default to `Concept`.
- `aliases` must be an array of strings (or absent). Non-string elements are filtered out.

Invalid entities (missing name) are discarded with a warning.

### Coreference Handling

Coreference resolution -- determining that "he" refers to "Albert Einstein" -- is handled within the LLM prompt rather than as a separate NLP step. The prompt explicitly instructs the LLM:

- Do not extract pronouns as entities.
- When the text uses a pronoun or definite description ("he", "she", "it", "the company", "the scientist"), resolve it to the named entity it refers to.
- If the referent is ambiguous, use the most recently mentioned entity of the appropriate type.

This approach works well for modern LLMs (GPT-4, Claude, Gemini) which have strong coreference resolution capabilities in their language understanding. For smaller or less capable models, coreference resolution may be less reliable, and callers should consider using shorter passages where the referent is unambiguous.

### Extraction from Multiple Passages

When processing multiple passages (via `buildGraph`), entity extraction runs independently for each passage. The same entity may be extracted from multiple passages with slightly different names or types. Cross-passage deduplication is handled in Step 5 (Entity Resolution), not during extraction. This keeps the extraction step stateless and parallelizable -- all passages can be processed concurrently.

---

## 7. Relationship Extraction

### LLM Prompt Design

Relationship extraction runs after entity extraction. The LLM receives both the passage text and the list of entities extracted from it, and is asked to identify all relationships between those entities.

**System message**:

```
You are an expert relationship extraction system. Given a text and a list of
entities found in it, identify all relationships between the entities.

Rules:
1. For each relationship, provide:
   - subject: The name of the subject entity (must be from the entity list).
   - predicate: A short verb or verb phrase describing the relationship.
   - object: The name of the object entity (must be from the entity list).
   - confidence: A number from 0.0 to 1.0 indicating how explicitly the
     relationship is stated. 1.0 = directly stated. 0.5-0.9 = strongly implied.
     Below 0.5 = weakly implied.
   - sourceText: The sentence or clause from the text that supports this
     relationship.
2. Extract both explicit and implicit relationships:
   - Explicit: "Einstein was born in Ulm" → ("Einstein", "born_in", "Ulm")
   - Implicit: "Einstein, the German physicist" → ("Einstein", "nationality", "German"),
     ("Einstein", "occupation", "physicist")
3. Decompose multi-hop statements into separate triples:
   - "Einstein worked at IAS in Princeton" →
     ("Einstein", "worked_at", "IAS"), ("IAS", "located_in", "Princeton")
4. Use the entity names exactly as provided in the entity list.
5. Return your response as a JSON array. No other text.
{predicateConstraints}

Output format:
[
  {
    "subject": "Entity Name",
    "predicate": "relationship_type",
    "object": "Entity Name",
    "confidence": 0.95,
    "sourceText": "The original sentence."
  },
  ...
]
```

**User message**:

```
Text:
---
{passageText}
---

Entities found in this text:
{entityListJson}

Extract all relationships between these entities.
```

### Triple Format

Each extracted triple is a structured object:

```typescript
interface Triple {
  subject: string;       // Entity name (matches an Entity.name)
  predicate: string;     // Normalized predicate: "born_in", "founded", "won"
  object: string;        // Entity name (matches an Entity.name)
  confidence: number;    // 0.0 to 1.0, default 1.0
  sourceText?: string;   // The text that supports this triple
  sourcePassage?: number; // Index of the passage this triple was extracted from
  properties?: Record<string, unknown>; // Additional properties on the relationship
}
```

### Open vs. Constrained Predicates

**Open predicates** (default): The LLM can produce any predicate it considers appropriate. This is best for exploratory extraction where the relationship types are not known in advance. Open extraction may produce many different predicates for semantically similar relationships ("founded", "started", "created", "established"), which increases graph noise. Post-processing can merge similar predicates (see Section 4, Predicate normalization).

**Constrained predicates**: The caller provides a list of allowed predicates. The LLM is instructed to only use predicates from this list and to skip relationships that do not fit any allowed predicate.

```typescript
const result = await extract(text, {
  llm,
  predicates: [
    { name: 'born_in', description: 'Place of birth' },
    { name: 'died_in', description: 'Place of death' },
    { name: 'founded', description: 'Founded or established an organization' },
    { name: 'works_at', description: 'Currently employed at' },
    { name: 'located_in', description: 'Geographic containment' },
    { name: 'won', description: 'Won an award, prize, or competition' },
  ],
});
```

Constrained predicates produce cleaner, more consistent graphs but may miss relationships that do not fit the predefined schema. The choice depends on the use case: ontology-conforming knowledge bases use constrained predicates, exploratory analysis uses open predicates.

### Relationship Properties

Some relationships have properties beyond the three core components. For example, "Einstein won the Nobel Prize in Physics in 1921" produces the triple `("Einstein", "won", "Nobel Prize in Physics")` with the property `{ year: "1921" }`. The LLM prompt can be configured to extract properties:

```typescript
const result = await extract(text, {
  llm,
  extractProperties: true,
});
// Triple: { subject: "Einstein", predicate: "won", object: "Nobel Prize in Physics",
//           properties: { year: "1921", field: "Physics" } }
```

When `extractProperties` is false (the default), properties are not extracted and the additional fact ("in 1921") may appear as a separate triple instead: `("Einstein", "won_in_year", "1921")`. This is simpler and avoids the complexity of property bags but creates additional triples.

### Multi-Hop Relationship Decomposition

A single sentence often encodes multiple relationships:

- "Einstein worked at the Institute for Advanced Study in Princeton, New Jersey" encodes:
  - `("Albert Einstein", "worked_at", "Institute for Advanced Study")`
  - `("Institute for Advanced Study", "located_in", "Princeton")`
  - `("Princeton", "located_in", "New Jersey")`

The LLM is instructed to decompose such statements into individual triples. Each triple represents one atomic relationship. This decomposition is critical for graph connectivity -- it creates intermediate nodes that connect distant entities through paths.

### Output Validation

After parsing the LLM's JSON output (using the same robust parsing as entity extraction), each triple is validated:

- `subject` must be a non-empty string that matches (or approximately matches) an extracted entity name.
- `predicate` must be a non-empty string.
- `object` must be a non-empty string that matches (or approximately matches) an extracted entity name.
- `confidence` must be a number between 0.0 and 1.0 (default: 1.0 if missing).
- Subject and object names that do not exactly match an entity name are matched using case-insensitive comparison. If no match is found, the triple is retained but the unmatched name is added as a new entity with type `Concept`.

Triples with empty subject, predicate, or object are discarded with a warning.

---

## 8. LLM Interface

### Pluggable Design

`kg-extract` does not call any LLM API directly. The caller provides an LLM function that takes a prompt and returns a response. This makes the package LLM-agnostic -- it works with OpenAI, Anthropic, Google, Cohere, Ollama, LM Studio, or any other model.

### Simple Function Interface

The simplest LLM interface is a function that takes a string prompt and returns a string response:

```typescript
type LLMFunction = (prompt: string) => Promise<string>;
```

Usage:

```typescript
import { extract } from 'kg-extract';
import OpenAI from 'openai';

const openai = new OpenAI();

const result = await extract(text, {
  llm: async (prompt) => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });
    return response.choices[0].message.content ?? '';
  },
});
```

When the simple function interface is used, `kg-extract` concatenates the system message and user message into a single prompt string. This works with both chat and completion models.

### Message-Based Interface

For callers who want to preserve the system/user message separation (which improves extraction quality for chat models), a message-based interface is available:

```typescript
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type LLMMessageFunction = (messages: LLMMessage[]) => Promise<string>;
```

Usage:

```typescript
const result = await extract(text, {
  llm: async (messages) => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0,
    });
    return response.choices[0].message.content ?? '';
  },
});
```

`kg-extract` detects which interface the caller provided by checking the function's parameter count (`.length`). If the function accepts a single string argument, the simple interface is used. If it accepts a single array argument, the message-based interface is used.

### Built-In Adapters

For convenience, `kg-extract` provides adapter factories for common LLM clients:

```typescript
import { adapters } from 'kg-extract';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// OpenAI adapter
const openai = new OpenAI();
const openaiLLM = adapters.openai(openai, { model: 'gpt-4o', temperature: 0 });

// Anthropic adapter
const anthropic = new Anthropic();
const anthropicLLM = adapters.anthropic(anthropic, { model: 'claude-sonnet-4-20250514', maxTokens: 4096 });

// Use with extract
const result = await extract(text, { llm: openaiLLM });
```

Adapters are thin wrappers that convert the `kg-extract` message format to the provider's API format. They are optional -- callers can always use the direct function interface.

### Custom Prompt Templates

The built-in prompt templates (Section 6 and Section 7) are optimized for general-purpose extraction. Callers working in specific domains may need different prompting strategies. The `promptTemplates` option allows replacing the built-in templates:

```typescript
const result = await extract(text, {
  llm,
  promptTemplates: {
    entityExtraction: {
      system: 'You are a biomedical entity extractor...',
      user: (passage) => `Extract genes, proteins, and diseases from:\n${passage}`,
    },
    relationshipExtraction: {
      system: 'You are a biomedical relationship extractor...',
      user: (passage, entities) =>
        `Text:\n${passage}\n\nEntities:\n${JSON.stringify(entities)}\n\nExtract relationships.`,
    },
  },
});
```

When custom prompt templates are provided, `kg-extract` still handles output parsing and validation. The LLM's response must be a JSON array in the expected format (entity objects or triple objects). If custom templates produce a different output format, the caller must also provide a custom `outputParser`.

### Structured Output Mode

Some LLMs support structured output (JSON mode, function calling, tool use). When the caller knows their LLM supports structured output, they can indicate this to avoid the JSON parsing heuristics:

```typescript
const result = await extract(text, {
  llm,
  structuredOutput: true,  // LLM guaranteed to return valid JSON
});
```

When `structuredOutput` is true, the parser skips the heuristic fixes (markdown stripping, single-quote replacement, trailing comma removal) and parses the output as strict JSON. Parse failures are not retried -- they are thrown as errors, since the LLM was expected to return valid JSON.

### Retry on Parse Failure

When the LLM produces output that cannot be parsed even after heuristic fixes, `kg-extract` retries with a corrective prompt:

```
Your previous response could not be parsed as valid JSON. Here is what you returned:

{previousOutput}

Please fix the JSON formatting and return a valid JSON array. Return only the JSON array, no other text.
```

Maximum 1 retry per extraction call. If the retry also fails, the extraction returns an empty result for that passage (no entities or triples) and includes a warning in the `ExtractionResult.warnings` array.

---

## 9. Entity Resolution

### Why Entity Resolution Matters

Without entity resolution, the same real-world entity appears as multiple disconnected nodes in the graph. "Albert Einstein", "Einstein", "A. Einstein", and "Professor Einstein" would each be separate nodes with separate relationships. This fragments the graph: the node "Einstein" might have the "born_in" relationship while "Albert Einstein" has the "won" relationship, making it impossible to traverse from birthplace to awards. Entity resolution merges these into a single node, producing a connected, useful graph.

### Resolution Algorithm

Entity resolution runs after all passages have been processed. It operates on the complete set of extracted entities across all passages.

**Phase 1: Alias-based merging**

For each entity, check if any of its aliases exactly match the canonical name of another entity. If so, merge them.

```
Entity A: { name: "Albert Einstein", aliases: ["Einstein"] }
Entity B: { name: "Einstein", aliases: [] }
→ Merge B into A. Result: { name: "Albert Einstein", aliases: ["Einstein"] }
```

**Phase 2: Case-insensitive name matching**

After Phase 1, check for entities with identical names after lowercasing and whitespace normalization. Merge duplicates.

```
Entity A: { name: "United Nations" }
Entity B: { name: "united nations" }
→ Merge B into A.
```

**Phase 3: Substring containment matching**

For entities of the same type, check if one entity's name is a substring of another's. If so, and if the shorter name has at least 3 characters, they are candidates for merging.

```
Entity A: { name: "Albert Einstein", type: "Person" }
Entity B: { name: "Einstein", type: "Person" }
→ Merge B into A (same type, "Einstein" is a substring of "Albert Einstein").
```

This phase is conservative: it only merges when types match. "Princeton" (Location) and "Princeton University" (Organization) are not merged because their types differ.

**Phase 4: Abbreviation matching**

Detect abbreviations and match them to their full forms:

- An all-uppercase entity name (e.g., "NASA") is checked as an abbreviation of multi-word entity names whose words' initial letters spell it out (e.g., "National Aeronautics and Space Administration").
- Common abbreviation patterns: "U.S." matches "United States", "UN" matches "United Nations".

```
Entity A: { name: "National Aeronautics and Space Administration", aliases: ["NASA"] }
Entity B: { name: "NASA" }
→ Merge B into A.
```

### Merge Semantics

When entity B is merged into entity A:

1. A's canonical name is preserved (it is the longer, more specific name).
2. B's name is added to A's aliases (if not already present).
3. All of B's aliases are added to A's aliases.
4. B's properties are merged into A's properties (A's values take precedence on conflict).
5. All triples referencing B (as subject or object) are updated to reference A.
6. B is removed from the entity set.

### Resolution Aggressiveness

The built-in resolution is deliberately conservative. It only merges entities when the evidence is strong (exact alias match, exact substring with same type, case-insensitive match, abbreviation pattern). False merges (incorrectly merging two distinct entities) are more harmful than missed merges (leaving duplicates in the graph), because a false merge permanently conflates two entities and corrupts all their relationships.

For more aggressive resolution (fuzzy string matching, embedding similarity, knowledge base linking), callers should use the `entityResolver` hook or the `entity-resolve` package.

### Configurable Resolution

Resolution behavior is configurable:

```typescript
const graph = await buildGraph(texts, {
  llm,
  resolution: {
    enabled: true,          // default: true
    aliasMatch: true,       // Phase 1, default: true
    caseInsensitive: true,  // Phase 2, default: true
    substringMatch: true,   // Phase 3, default: true
    abbreviationMatch: true, // Phase 4, default: true
    minNameLength: 3,       // Minimum name length for substring matching, default: 3
  },
});
```

Setting `resolution.enabled: false` disables all resolution. Individual phases can be toggled independently.

---

## 10. In-Memory Graph

### Data Structure

The `KnowledgeGraph` class stores the graph as an adjacency list. Each entity (node) has an entry in a `Map<string, EntityNode>` keyed by canonical entity name. Each entity node contains:

- The entity metadata (name, type, aliases, properties).
- An array of outgoing edges (triples where this entity is the subject).
- An array of incoming edges (triples where this entity is the object).

```typescript
interface EntityNode {
  entity: Entity;
  outgoing: Edge[];  // triples where entity is subject
  incoming: Edge[];  // triples where entity is object
}

interface Edge {
  subject: string;    // entity name
  predicate: string;  // normalized predicate
  object: string;     // entity name
  confidence: number;
  sourceText?: string;
  sourcePassage?: number;
  properties?: Record<string, unknown>;
}
```

### Why Adjacency List

The adjacency list representation is chosen for the following reasons:

1. **O(1) entity lookup**: Given an entity name, retrieve all its relationships in constant time.
2. **O(degree) neighbor traversal**: Iterating over an entity's neighbors is proportional to the number of relationships, not the total graph size.
3. **Memory efficiency**: The adjacency list stores each edge once (plus back-references). For sparse graphs (typical of knowledge graphs, where most entities have a small number of relationships), this is much more memory-efficient than an adjacency matrix.
4. **Natural fit for knowledge graphs**: Knowledge graphs are typically sparse (each entity has 5-50 relationships, not thousands). The adjacency list exploits this sparsity.

### Graph Operations

The `KnowledgeGraph` class provides the following operations:

#### `addTriple(triple)`

Add a single triple to the graph. If the subject or object entity does not exist, create it with type `Concept`. If the entity already exists, the existing entity metadata is preserved.

```typescript
graph.addTriple({
  subject: 'Albert Einstein',
  predicate: 'born_in',
  object: 'Ulm',
});
```

**Time complexity**: O(1) amortized (hash map insertion).

#### `addEntity(entity)`

Add an entity to the graph without any relationships. If the entity already exists, merge the metadata (update type if the existing type is `Concept` and the new type is more specific, merge aliases and properties).

```typescript
graph.addEntity({ name: 'Albert Einstein', type: 'Person', aliases: ['Einstein'] });
```

**Time complexity**: O(1).

#### `getEntity(name)`

Retrieve an entity by name. Returns the `EntityNode` or `undefined` if not found. Name matching is case-insensitive.

```typescript
const node = graph.getEntity('Albert Einstein');
// node.entity: { name: 'Albert Einstein', type: 'Person', aliases: ['Einstein'] }
// node.outgoing: [{ predicate: 'born_in', object: 'Ulm', ... }, ...]
// node.incoming: [{ predicate: 'won_by', subject: 'Nobel Prize', ... }, ...]
```

**Time complexity**: O(1).

#### `getRelationships(entityName, direction?)`

Get all relationships for an entity. Optionally filter by direction (`outgoing`, `incoming`, or `both` -- the default).

```typescript
const rels = graph.getRelationships('Albert Einstein', 'outgoing');
// All triples where Einstein is the subject
```

**Time complexity**: O(degree).

#### `query(subject?, predicate?, object?)`

Pattern-based triple matching with wildcards. Any parameter can be `'*'` (or `undefined`/`null`) to match any value. Returns all triples matching the pattern.

```typescript
// All triples about Einstein
graph.query('Albert Einstein', '*', '*');

// All "born_in" relationships
graph.query('*', 'born_in', '*');

// Who was born in Ulm?
graph.query('*', 'born_in', 'Ulm');

// Everything about everything (all triples)
graph.query('*', '*', '*');
```

**Time complexity**: Depends on the pattern. With a subject specified: O(degree of subject). With only predicate: O(total edges) with a predicate index. With only object: O(degree of object via incoming edges). Full wildcard: O(total edges).

**Predicate index**: The graph maintains a secondary index from predicate to edges, enabling efficient predicate-only queries.

#### `findPath(from, to, options?)`

Find the shortest path between two entities using BFS. Returns the sequence of triples forming the path, or `null` if no path exists.

```typescript
const path = graph.findPath('Albert Einstein', 'Princeton');
// [
//   { subject: 'Albert Einstein', predicate: 'worked_at', object: 'Institute for Advanced Study' },
//   { subject: 'Institute for Advanced Study', predicate: 'located_in', object: 'Princeton' },
// ]
```

Options:
- `maxDepth`: Maximum path length (default: 10). Prevents searching the entire graph for disconnected entities.
- `directed`: If `true` (default), follow edges in their natural direction only. If `false`, traverse edges in both directions (treat the graph as undirected).

**Time complexity**: O(V + E) where V is the number of entities and E is the number of edges, bounded by the `maxDepth` parameter.

#### `getNeighbors(entityName, depth?)`

Get all entities within N hops of the given entity. Returns an array of `EntityNode` objects.

```typescript
// Direct neighbors (1 hop)
const neighbors = graph.getNeighbors('Albert Einstein', 1);

// Extended neighborhood (2 hops)
const extended = graph.getNeighbors('Albert Einstein', 2);
```

**Time complexity**: O(V_reachable + E_reachable) within the depth limit.

#### `getSubgraph(entityName, depth?)`

Extract the subgraph containing all entities and triples within N hops of the given entity. Returns a new `KnowledgeGraph` instance.

```typescript
const sub = graph.getSubgraph('Albert Einstein', 2);
// A new KnowledgeGraph containing Einstein, all entities within 2 hops,
// and all triples between them.
```

This is useful for providing focused graph context to an LLM: extract the subgraph around a topic entity and serialize it as context for a RAG prompt.

**Time complexity**: O(V_reachable + E_reachable).

#### `merge(other)`

Merge another `KnowledgeGraph` into this graph. All entities and triples from the other graph are added to this graph. Duplicate entities (same name) are merged using the same merge semantics as entity resolution. Duplicate triples (same subject, predicate, object) are deduplicated, keeping the one with the higher confidence score.

```typescript
const graph1 = await buildGraph(texts1, { llm });
const graph2 = await buildGraph(texts2, { llm });
graph1.merge(graph2);
// graph1 now contains entities and triples from both graphs.
```

**Time complexity**: O(V_other + E_other).

#### `removeTriple(subject, predicate, object)`

Remove a specific triple from the graph. Returns `true` if the triple was found and removed, `false` otherwise.

**Time complexity**: O(degree of subject).

#### `removeEntity(name)`

Remove an entity and all its associated triples (both incoming and outgoing). Returns `true` if the entity was found and removed.

**Time complexity**: O(degree of entity).

#### `entities()`

Return an iterator over all entity nodes in the graph.

```typescript
for (const node of graph.entities()) {
  console.log(node.entity.name, node.entity.type, node.outgoing.length);
}
```

#### `triples()`

Return an iterator over all triples (edges) in the graph. Each triple is yielded exactly once.

```typescript
for (const triple of graph.triples()) {
  console.log(`${triple.subject} --[${triple.predicate}]--> ${triple.object}`);
}
```

#### `stats()`

Return graph statistics:

```typescript
interface GraphStats {
  nodeCount: number;           // Number of entities
  edgeCount: number;           // Number of triples
  connectedComponents: number; // Number of connected components (undirected)
  avgDegree: number;           // Average number of edges per node
  maxDegree: number;           // Maximum degree (most connected entity)
  mostConnected: string;       // Name of the most connected entity
  entityTypes: Record<string, number>; // Count of entities per type
  predicates: Record<string, number>;  // Count of triples per predicate
}
```

**Time complexity**: O(V + E) for connected components (requires BFS/DFS). Node/edge count is O(1) (maintained incrementally).

---

## 11. Graph Queries

### Pattern Matching

The `query(subject?, predicate?, object?)` method is the primary query interface. It performs pattern-based triple matching where each component can be a specific value or a wildcard (`'*'`, `undefined`, or `null`).

**Query patterns and their semantics**:

| Pattern | Meaning | Example |
|---------|---------|---------|
| `(S, P, O)` | Exact triple lookup | `query("Einstein", "born_in", "Ulm")` |
| `(S, P, *)` | All objects for a subject-predicate pair | `query("Einstein", "won", "*")` |
| `(S, *, O)` | All predicates between two entities | `query("Einstein", "*", "Ulm")` |
| `(S, *, *)` | All triples with this subject | `query("Einstein", "*", "*")` |
| `(*, P, O)` | All subjects for a predicate-object pair | `query("*", "born_in", "Ulm")` |
| `(*, P, *)` | All triples with this predicate | `query("*", "born_in", "*")` |
| `(*, *, O)` | All triples with this object | `query("*", "*", "Ulm")` |
| `(*, *, *)` | All triples in the graph | `query("*", "*", "*")` |

Query results are returned as an array of `Triple` objects, sorted by confidence score (highest first).

### Path Finding

`findPath(from, to, options?)` uses breadth-first search to find the shortest path between two entities. BFS guarantees the shortest path in an unweighted graph.

**Algorithm**:

```
function findPath(from, to, maxDepth):
  if from == to: return []
  queue = [(from, [])]
  visited = {from}

  while queue is not empty:
    (current, path) = queue.dequeue()
    if path.length >= maxDepth: continue

    for each edge in outgoing[current]:
      if edge.object == to:
        return path + [edge]
      if edge.object not in visited:
        visited.add(edge.object)
        queue.enqueue((edge.object, path + [edge]))

    if not directed:
      for each edge in incoming[current]:
        if edge.subject == to:
          return path + [edge]
        if edge.subject not in visited:
          visited.add(edge.subject)
          queue.enqueue((edge.subject, path + [edge]))

  return null  // no path found
```

The `directed: false` option allows traversing edges in reverse (from object to subject), effectively treating the graph as undirected. This is useful for knowledge graphs where relationships are often bidirectional in meaning ("Einstein worked_at IAS" implies "IAS employed Einstein").

### Subgraph Extraction

`getSubgraph(entityName, depth)` extracts all entities and triples within N hops of a given entity. This uses BFS from the starting entity, collecting all entities visited within the depth limit and all edges between them.

**Use cases**:
- Providing focused graph context for RAG: extract a 2-hop subgraph around a topic entity and serialize it.
- Visualization: export a subgraph for rendering rather than the entire (potentially large) graph.
- Analysis: study the local neighborhood of a specific entity.

### Type-Based Queries

The `KnowledgeGraph` class provides type-based entity queries:

```typescript
// All entities of type "Person"
const people = graph.getEntitiesByType('Person');

// All entities of type "Organization"
const orgs = graph.getEntitiesByType('Organization');
```

The type index is maintained incrementally as entities are added.

### Filtered Queries

The `query` method accepts an optional filter function for fine-grained control:

```typescript
// All high-confidence triples about Einstein
const results = graph.query('Albert Einstein', '*', '*', {
  filter: (triple) => triple.confidence >= 0.8,
});

// All "born_in" relationships from passage 0
const results = graph.query('*', 'born_in', '*', {
  filter: (triple) => triple.sourcePassage === 0,
});
```

---

## 12. Serialization

### JSON Export/Import

**Export**: `graph.toJSON()` returns a plain JavaScript object that captures the complete graph state:

```typescript
interface GraphJSON {
  entities: Array<{
    name: string;
    type: string;
    aliases: string[];
    properties: Record<string, unknown>;
  }>;
  triples: Array<{
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
    sourceText?: string;
    sourcePassage?: number;
    properties?: Record<string, unknown>;
  }>;
  metadata: {
    createdAt: string;       // ISO 8601 timestamp
    version: string;         // kg-extract version
    entityCount: number;
    tripleCount: number;
  };
}
```

The JSON export is lossless: `KnowledgeGraph.fromJSON(graph.toJSON())` produces a graph identical to the original.

**Import**: `KnowledgeGraph.fromJSON(json)` constructs a `KnowledgeGraph` from a JSON object or a JSON string.

```typescript
import { KnowledgeGraph } from 'kg-extract';

// From object
const graph = KnowledgeGraph.fromJSON(jsonObject);

// From string
const graph = KnowledgeGraph.fromJSON(jsonString);

// From file
import { readFileSync } from 'fs';
const graph = KnowledgeGraph.fromJSON(readFileSync('graph.json', 'utf-8'));
```

### GraphML Export

GraphML is a standard XML-based graph interchange format supported by Gephi, yEd, Cytoscape, NetworkX, and igraph.

```typescript
const graphml = graph.toGraphML();
// Returns a string containing the GraphML XML document.
```

The GraphML export maps:
- Entities to `<node>` elements with `id`, `name`, `type`, and `aliases` attributes.
- Triples to `<edge>` elements with `source`, `target`, `predicate`, and `confidence` attributes.

### CSV/TSV Triple Export

A flat tabular export of all triples, suitable for spreadsheet analysis or loading into tabular databases.

```typescript
const csv = graph.toCSV();  // comma-separated
const tsv = graph.toTSV();  // tab-separated
```

Format:

```
subject,predicate,object,confidence,source_text
Albert Einstein,born_in,Ulm,0.95,"Albert Einstein was born in Ulm"
Albert Einstein,won,Nobel Prize in Physics,0.90,"Einstein won the Nobel Prize"
```

The first row is a header. Values containing the delimiter are quoted. Newlines within values are escaped.

### Cypher Export

Cypher is the query language for Neo4j. The Cypher export produces a series of `CREATE` statements that, when executed against a Neo4j database, recreate the graph.

```typescript
const cypher = graph.toCypher();
```

Output:

```cypher
CREATE (n0:Person {name: 'Albert Einstein', aliases: ['Einstein']})
CREATE (n1:Location {name: 'Ulm'})
CREATE (n2:Event {name: 'Nobel Prize in Physics'})
CREATE (n0)-[:BORN_IN {confidence: 0.95, sourceText: 'Albert Einstein was born in Ulm'}]->(n1)
CREATE (n0)-[:WON {confidence: 0.90}]->(n2)
```

Node labels are the entity types. Relationship types are the predicates converted to UPPER_SNAKE_CASE (Neo4j convention). Entity properties (name, aliases) and edge properties (confidence, sourceText) are included as property maps.

The Cypher export can be piped directly into `neo4j-shell` or executed via the `neo4j-driver` package:

```typescript
import neo4j from 'neo4j-driver';

const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'password'));
const session = driver.session();

const cypher = graph.toCypher();
for (const statement of cypher.split('\n').filter(s => s.trim())) {
  await session.run(statement);
}
```

---

## 13. API Surface

### Installation

```bash
npm install kg-extract
```

### Core Functions

#### `extract(text, options)`

The primary extraction function. Extracts entities and triples from a single text passage using an LLM.

```typescript
import { extract } from 'kg-extract';

const result = await extract(
  'Albert Einstein was born in Ulm, Germany in 1879. He later won the Nobel Prize in Physics.',
  {
    llm: async (prompt) => { /* call your LLM */ },
  },
);

console.log(result.entities);
// [
//   { name: 'Albert Einstein', type: 'Person', aliases: ['Einstein'] },
//   { name: 'Ulm', type: 'Location' },
//   { name: 'Germany', type: 'Location' },
//   { name: 'Nobel Prize in Physics', type: 'Event' },
// ]

console.log(result.triples);
// [
//   { subject: 'Albert Einstein', predicate: 'born_in', object: 'Ulm', confidence: 0.95 },
//   { subject: 'Ulm', predicate: 'located_in', object: 'Germany', confidence: 0.90 },
//   { subject: 'Albert Einstein', predicate: 'won', object: 'Nobel Prize in Physics', confidence: 0.95 },
// ]
```

**Signature**:

```typescript
function extract(
  text: string,
  options: ExtractOptions,
): Promise<ExtractionResult>;
```

**Throws** `ExtractionError` if:
- `options.llm` is not provided.
- The text is empty.
- All LLM calls fail (network error, timeout).

#### `buildGraph(texts, options)`

Processes one or more texts, extracts entities and triples from each, resolves entities across texts, and assembles the results into a queryable `KnowledgeGraph`.

```typescript
import { buildGraph } from 'kg-extract';

const graph = await buildGraph(
  [
    'Albert Einstein was born in Ulm. He studied at ETH Zurich.',
    'Einstein published his theory of general relativity in 1915.',
    'The Nobel Prize in Physics was awarded to Einstein in 1921.',
  ],
  {
    llm: async (prompt) => { /* call your LLM */ },
  },
);

console.log(graph.stats().nodeCount);  // ~6 entities
console.log(graph.stats().edgeCount);  // ~6 triples

// Query the graph
const about = graph.query('Albert Einstein', '*', '*');
console.log(about.length);  // All triples about Einstein

// Find path
const path = graph.findPath('Ulm', 'Nobel Prize in Physics');
// Ulm <-[born_in]- Einstein -[won]-> Nobel Prize in Physics
```

When a single string is passed, it is split into passages using the built-in splitter. When an array of strings is passed, each string is treated as a separate passage.

**Signature**:

```typescript
function buildGraph(
  texts: string | string[],
  options: BuildGraphOptions,
): Promise<KnowledgeGraph>;
```

#### `createExtractor(config)`

Factory for a pre-configured extractor instance. Avoids re-specifying options on every call.

```typescript
import { createExtractor } from 'kg-extract';

const extractor = createExtractor({
  llm: openaiLLM,
  entityTypes: [
    { name: 'Gene', description: 'A gene or genetic marker' },
  ],
  combinedExtraction: false,
  resolution: { substringMatch: true },
});

const result1 = await extractor.extract(text1);
const result2 = await extractor.extract(text2);
const graph = await extractor.buildGraph([text1, text2, text3]);
```

**Signature**:

```typescript
function createExtractor(config: ExtractorConfig): Extractor;

interface Extractor {
  extract(text: string, overrides?: Partial<ExtractOptions>): Promise<ExtractionResult>;
  buildGraph(texts: string | string[], overrides?: Partial<BuildGraphOptions>): Promise<KnowledgeGraph>;
}
```

### Type Definitions

```typescript
// -- Entity Types --------------------------------------------------------

/** Built-in entity type names. */
type BuiltInEntityType = 'Person' | 'Organization' | 'Location' | 'Date'
                        | 'Event' | 'Concept' | 'Product';

/** An entity type, either built-in or custom. */
type EntityType = BuiltInEntityType | string;

/** A custom entity type definition. */
interface CustomEntityType {
  /** The type name. */
  name: string;
  /** Description to include in the LLM prompt. */
  description: string;
}

/** An entity extracted from text. */
interface Entity {
  /** Canonical name of the entity. */
  name: string;
  /** Entity type. */
  type: EntityType;
  /** Alternative names or abbreviations. */
  aliases?: string[];
  /** Additional properties. */
  properties?: Record<string, unknown>;
}

// -- Triple Types --------------------------------------------------------

/** A relationship triple. */
interface Triple {
  /** Subject entity name. */
  subject: string;
  /** Predicate (relationship type), normalized. */
  predicate: string;
  /** Object entity name. */
  object: string;
  /** Confidence score (0.0-1.0). Default: 1.0. */
  confidence: number;
  /** Source text that supports this triple. */
  sourceText?: string;
  /** Index of the passage this triple was extracted from. */
  sourcePassage?: number;
  /** Additional properties on the relationship. */
  properties?: Record<string, unknown>;
}

// -- Extraction Results --------------------------------------------------

/** The result of extracting entities and triples from a text. */
interface ExtractionResult {
  /** All extracted entities. */
  entities: Entity[];
  /** All extracted triples. */
  triples: Triple[];
  /** Number of LLM calls made. */
  llmCalls: number;
  /** Total LLM response time in milliseconds. */
  llmDurationMs: number;
  /** Warnings (parse failures, validation issues). */
  warnings: string[];
  /** The original text. */
  text: string;
  /** Passages the text was split into (if any splitting occurred). */
  passages?: string[];
}

// -- KnowledgeGraph Types ------------------------------------------------

/** A node in the knowledge graph. */
interface EntityNode {
  /** The entity metadata. */
  entity: Entity;
  /** Outgoing edges (triples where this entity is the subject). */
  outgoing: Triple[];
  /** Incoming edges (triples where this entity is the object). */
  incoming: Triple[];
}

/** Graph statistics. */
interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  connectedComponents: number;
  avgDegree: number;
  maxDegree: number;
  mostConnected: string;
  entityTypes: Record<string, number>;
  predicates: Record<string, number>;
}

// -- Options -------------------------------------------------------------

/** LLM function: simple string-in-string-out. */
type LLMFunction = (prompt: string) => Promise<string>;

/** LLM function: message-based. */
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
type LLMMessageFunction = (messages: LLMMessage[]) => Promise<string>;

/** Either LLM interface. */
type LLM = LLMFunction | LLMMessageFunction;

/** A predicate constraint. */
interface PredicateConstraint {
  /** The predicate name (normalized form). */
  name: string;
  /** Description for the LLM prompt. */
  description: string;
}

/** Custom prompt templates. */
interface PromptTemplates {
  entityExtraction?: {
    system?: string;
    user?: (passage: string) => string;
  };
  relationshipExtraction?: {
    system?: string;
    user?: (passage: string, entities: Entity[]) => string;
  };
}

/** Options for the extract() function. */
interface ExtractOptions {
  /** The LLM function to use for extraction. Required. */
  llm: LLM;

  /**
   * Additional entity types beyond the built-in set.
   * Default: [] (built-in types only).
   */
  entityTypes?: CustomEntityType[];

  /**
   * Predicate constraints. When provided, only these predicates are allowed.
   * Default: undefined (open predicates -- any predicate is allowed).
   */
  predicates?: PredicateConstraint[];

  /**
   * Whether to extract relationship properties (year, amount, etc.)
   * in addition to the core triple.
   * Default: false.
   */
  extractProperties?: boolean;

  /**
   * Whether to perform entity and relationship extraction in a single
   * LLM call (faster, cheaper) or two separate calls (more accurate).
   * Default: false (two separate calls).
   */
  combinedExtraction?: boolean;

  /**
   * Whether the LLM is guaranteed to return valid JSON
   * (e.g., using JSON mode or function calling).
   * When true, heuristic JSON parsing fixes are skipped.
   * Default: false.
   */
  structuredOutput?: boolean;

  /**
   * Custom prompt templates. When provided, these replace the built-in
   * prompts for entity and/or relationship extraction.
   * Default: undefined (built-in prompts).
   */
  promptTemplates?: PromptTemplates;

  /**
   * Few-shot examples to include in the extraction prompts.
   * Default: built-in examples (2-3 examples).
   * Set to [] to disable few-shot examples.
   */
  examples?: Array<{ text: string; entities: Entity[]; triples: Triple[] }>;

  /**
   * Maximum number of tokens per passage when splitting long text.
   * Default: 1500.
   */
  maxPassageTokens?: number;

  /**
   * Minimum number of tokens per passage (short passages are merged).
   * Default: 100.
   */
  minPassageTokens?: number;

  /**
   * Maximum number of concurrent LLM calls.
   * Default: 3.
   */
  concurrency?: number;

  /**
   * Minimum confidence score to include a triple in the result.
   * Triples with confidence below this threshold are discarded.
   * Default: 0.0 (include all triples).
   */
  minConfidence?: number;
}

/** Options for the buildGraph() function (extends ExtractOptions). */
interface BuildGraphOptions extends ExtractOptions {
  /**
   * Entity resolution configuration.
   * Default: all resolution strategies enabled.
   */
  resolution?: {
    enabled?: boolean;           // default: true
    aliasMatch?: boolean;        // default: true
    caseInsensitive?: boolean;   // default: true
    substringMatch?: boolean;    // default: true
    abbreviationMatch?: boolean; // default: true
    minNameLength?: number;      // default: 3
  };

  /**
   * Custom entity resolver function. When provided, replaces the
   * built-in resolution algorithm.
   */
  entityResolver?: (entities: Entity[]) => Promise<EntityResolutionResult>;

  /**
   * Custom passage splitter function. When provided, replaces the
   * built-in paragraph-boundary splitter.
   */
  splitter?: (text: string) => string[];
}

/** The result of entity resolution. */
interface EntityResolutionResult {
  /** Map from original entity name to canonical entity name. */
  mergeMap: Record<string, string>;
  /** The deduplicated entity list. */
  entities: Entity[];
}

/** Configuration for createExtractor(). */
interface ExtractorConfig extends Partial<BuildGraphOptions> {
  /** The LLM function. Required. */
  llm: LLM;
}

// -- KnowledgeGraph Class ------------------------------------------------

/** Query options for pattern matching. */
interface QueryOptions {
  /** Filter function applied to matching triples. */
  filter?: (triple: Triple) => boolean;
  /** Maximum number of results. Default: unlimited. */
  limit?: number;
}

/** Path-finding options. */
interface PathOptions {
  /** Maximum path length (number of edges). Default: 10. */
  maxDepth?: number;
  /** Whether to follow edges in natural direction only (true) or both directions (false). Default: true. */
  directed?: boolean;
}

/** Error thrown by kg-extract on extraction or graph operation failures. */
class ExtractionError extends Error {
  code: 'NO_LLM' | 'EMPTY_TEXT' | 'LLM_FAILED' | 'PARSE_FAILED'
     | 'ENTITY_NOT_FOUND' | 'INVALID_OPTIONS';
}
```

### KnowledgeGraph Class

```typescript
class KnowledgeGraph {
  // -- Construction --
  constructor();
  static fromJSON(json: string | GraphJSON): KnowledgeGraph;

  // -- Mutation --
  addTriple(triple: Triple): void;
  addEntity(entity: Entity): void;
  removeTriple(subject: string, predicate: string, object: string): boolean;
  removeEntity(name: string): boolean;
  merge(other: KnowledgeGraph): void;

  // -- Query --
  getEntity(name: string): EntityNode | undefined;
  getRelationships(entityName: string, direction?: 'outgoing' | 'incoming' | 'both'): Triple[];
  query(subject?: string | null, predicate?: string | null, object?: string | null, options?: QueryOptions): Triple[];
  getEntitiesByType(type: EntityType): EntityNode[];
  findPath(from: string, to: string, options?: PathOptions): Triple[] | null;
  getNeighbors(entityName: string, depth?: number): EntityNode[];
  getSubgraph(entityName: string, depth?: number): KnowledgeGraph;

  // -- Iteration --
  entities(): IterableIterator<EntityNode>;
  triples(): IterableIterator<Triple>;

  // -- Statistics --
  stats(): GraphStats;

  // -- Serialization --
  toJSON(): GraphJSON;
  toGraphML(): string;
  toCSV(): string;
  toTSV(): string;
  toCypher(): string;
}
```

### Usage Examples

#### Basic Extraction

```typescript
import { extract } from 'kg-extract';
import OpenAI from 'openai';

const openai = new OpenAI();
const llm = async (prompt: string) => {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  });
  return res.choices[0].message.content ?? '';
};

const result = await extract(
  'Marie Curie discovered radium in 1898 at the University of Paris. She won the Nobel Prize in Physics in 1903 and the Nobel Prize in Chemistry in 1911.',
  { llm },
);

console.log(result.entities.map(e => `${e.name} (${e.type})`));
// Marie Curie (Person), Radium (Concept), University of Paris (Organization),
// Nobel Prize in Physics (Event), Nobel Prize in Chemistry (Event)

console.log(result.triples.map(t => `${t.subject} --[${t.predicate}]--> ${t.object}`));
// Marie Curie --[discovered]--> Radium
// Marie Curie --[discovered_at]--> University of Paris
// Marie Curie --[won]--> Nobel Prize in Physics
// Marie Curie --[won]--> Nobel Prize in Chemistry
```

#### Building a Knowledge Graph from Multiple Documents

```typescript
import { buildGraph } from 'kg-extract';

const documents = [
  'Albert Einstein was born in Ulm, Germany in 1879. He studied physics at ETH Zurich.',
  'Einstein published the theory of special relativity in 1905 while working at the Swiss Patent Office in Bern.',
  'In 1915, Einstein completed his theory of general relativity. He received the Nobel Prize in Physics in 1921.',
  'Einstein emigrated to the United States in 1933 and joined the Institute for Advanced Study in Princeton.',
];

const graph = await buildGraph(documents, { llm });

// Query: What do we know about Einstein?
const einstein = graph.query('Albert Einstein', '*', '*');
for (const t of einstein) {
  console.log(`  ${t.predicate} → ${t.object} (confidence: ${t.confidence})`);
}

// Path: How is Ulm connected to Princeton?
const path = graph.findPath('Ulm', 'Princeton', { directed: false });
if (path) {
  console.log('Path from Ulm to Princeton:');
  for (const step of path) {
    console.log(`  ${step.subject} --[${step.predicate}]--> ${step.object}`);
  }
}

// Export for Neo4j
const cypher = graph.toCypher();
fs.writeFileSync('einstein.cypher', cypher);
```

#### Domain-Specific Extraction with Constrained Predicates

```typescript
import { createExtractor } from 'kg-extract';

const extractor = createExtractor({
  llm,
  entityTypes: [
    { name: 'Gene', description: 'A gene or genetic marker' },
    { name: 'Protein', description: 'A protein or enzyme' },
    { name: 'Disease', description: 'A disease or medical condition' },
    { name: 'Drug', description: 'A pharmaceutical drug or compound' },
  ],
  predicates: [
    { name: 'causes', description: 'Entity causes or leads to another entity' },
    { name: 'treats', description: 'Drug treats a disease' },
    { name: 'encodes', description: 'Gene encodes a protein' },
    { name: 'associated_with', description: 'Entity is associated with another entity' },
    { name: 'inhibits', description: 'Entity inhibits or blocks another entity' },
    { name: 'activates', description: 'Entity activates or promotes another entity' },
  ],
});

const graph = await extractor.buildGraph(biomedicalTexts);
```

#### GraphRAG Integration

```typescript
import { buildGraph, KnowledgeGraph } from 'kg-extract';
import { buildPrompt } from 'rag-prompt-builder';

// Step 1: Build knowledge graph from corpus
const graph = await buildGraph(corpusTexts, { llm });

// Step 2: For a user query, extract relevant subgraph
const queryEntities = await extract(userQuery, { llm });
const relevantSubgraph = graph.getSubgraph(queryEntities.entities[0].name, 2);

// Step 3: Serialize subgraph as structured context
const graphContext = relevantSubgraph.triples()
  .map(t => `${t.subject} → ${t.predicate} → ${t.object}`)
  .join('\n');

// Step 4: Build RAG prompt with graph context
const prompt = buildPrompt({
  query: userQuery,
  context: `Knowledge graph context:\n${graphContext}`,
});

const answer = await llm(prompt);
```

---

## 14. Configuration

### All Options with Defaults

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `llm` | `LLM` | *required* | LLM function for extraction |
| `entityTypes` | `CustomEntityType[]` | `[]` | Additional entity types |
| `predicates` | `PredicateConstraint[]` | `undefined` | Allowed predicates (open if undefined) |
| `extractProperties` | `boolean` | `false` | Extract relationship properties |
| `combinedExtraction` | `boolean` | `false` | Single LLM call for entities + relationships |
| `structuredOutput` | `boolean` | `false` | LLM guarantees valid JSON output |
| `promptTemplates` | `PromptTemplates` | built-in | Custom prompt templates |
| `examples` | `Array` | built-in | Few-shot examples for prompts |
| `maxPassageTokens` | `number` | `1500` | Max tokens per passage |
| `minPassageTokens` | `number` | `100` | Min tokens per passage (merge shorter) |
| `concurrency` | `number` | `3` | Max concurrent LLM calls |
| `minConfidence` | `number` | `0.0` | Minimum triple confidence threshold |
| `resolution.enabled` | `boolean` | `true` | Enable entity resolution |
| `resolution.aliasMatch` | `boolean` | `true` | Merge entities by alias |
| `resolution.caseInsensitive` | `boolean` | `true` | Case-insensitive name matching |
| `resolution.substringMatch` | `boolean` | `true` | Substring containment matching |
| `resolution.abbreviationMatch` | `boolean` | `true` | Abbreviation detection |
| `resolution.minNameLength` | `number` | `3` | Min name length for substring matching |

### Configuration Precedence

When using `createExtractor`, options are merged with the following precedence (highest first):

1. Per-call overrides passed to `extractor.extract(text, overrides)` or `extractor.buildGraph(texts, overrides)`.
2. Factory-level options passed to `createExtractor(config)`.
3. Built-in defaults.

---

## 15. Integration

### With `entity-resolve`

`entity-resolve` provides production-grade entity resolution using fuzzy string matching, alias graphs, and optionally embedding-based similarity. It replaces the built-in resolution algorithm for callers who need higher accuracy.

```typescript
import { buildGraph } from 'kg-extract';
import { createResolver } from 'entity-resolve';

const resolver = createResolver({ strategy: 'fuzzy', threshold: 0.85 });

const graph = await buildGraph(texts, {
  llm,
  entityResolver: async (entities) => resolver.resolve(entities),
});
```

`kg-extract` provides the extracted entities; `entity-resolve` deduplicates them with more sophisticated algorithms.

### With `embed-cache`

`embed-cache` provides embedding generation and caching. It can be used to compute entity name embeddings for similarity-based entity resolution:

```typescript
import { buildGraph } from 'kg-extract';
import { createCache } from 'embed-cache';

const cache = createCache({ embedder: openaiEmbed, model: 'text-embedding-3-small' });

const graph = await buildGraph(texts, {
  llm,
  entityResolver: async (entities) => {
    // Embed all entity names
    const embeddings = await cache.embedBatch(entities.map(e => e.name));
    // Find similar pairs and merge
    return resolveByEmbeddingSimilarity(entities, embeddings, 0.9);
  },
});
```

### With `rag-prompt-builder`

`rag-prompt-builder` composes RAG prompts from context chunks. Knowledge graph subgraphs can be serialized and included as structured context alongside or instead of raw text chunks:

```typescript
import { buildGraph } from 'kg-extract';
import { buildPrompt } from 'rag-prompt-builder';

const graph = await buildGraph(documents, { llm });
const subgraph = graph.getSubgraph('topic-entity', 2);

const graphTriples = [...subgraph.triples()].map(
  t => `${t.subject} | ${t.predicate} | ${t.object}`
).join('\n');

const prompt = buildPrompt({
  query: userQuery,
  chunks: textChunks,
  additionalContext: `\nStructured knowledge:\n${graphTriples}`,
});
```

### With `chunk-smart`

`chunk-smart` provides semantically aware text splitting that respects paragraph, section, and sentence boundaries. It produces higher-quality passages for extraction than the built-in paragraph splitter:

```typescript
import { chunk } from 'chunk-smart';
import { buildGraph } from 'kg-extract';

const passages = chunk(longDocument, { maxChunkSize: 1500, overlap: 100 });
const graph = await buildGraph(passages.map(p => p.content), { llm });
```

Using `chunk-smart` is recommended for production pipelines where extraction quality matters. The built-in splitter is adequate for prototyping and simple use cases.

---

## 16. Testing Strategy

### Unit Tests

Each component has isolated unit tests:

- **Passage splitter**: Verify that long texts are split on paragraph boundaries. Verify that short paragraphs are merged. Verify that the maximum passage length is respected. Test with texts containing single paragraphs, many short paragraphs, one very long paragraph, and edge cases (empty text, text with only newlines).

- **Entity extraction prompt construction**: Verify that the prompt includes the correct system message, user message, entity types, and few-shot examples. Verify that custom entity types are appended correctly. Verify that custom prompt templates replace the built-in templates.

- **Relationship extraction prompt construction**: Verify that the prompt includes the entity list from the previous step. Verify that predicate constraints are included when provided. Verify the combined extraction mode produces a single prompt rather than two.

- **JSON output parser**: Test with clean JSON, markdown-wrapped JSON, JSON with preamble, single-quoted strings, trailing commas, nested JSON, and completely invalid output. Verify that the parser extracts the correct data from each format.

- **Entity validation**: Verify that entities with missing names are discarded. Verify that unknown types default to `Concept`. Verify that non-string aliases are filtered out.

- **Triple validation**: Verify that triples with empty subject/predicate/object are discarded. Verify that confidence scores outside [0, 1] are clamped. Verify that subject/object names are matched to entities (case-insensitive).

- **Entity name normalization**: Test title casing, whitespace collapsing, article stripping. Verify that "the United Nations" becomes "United Nations" but "The Hague" is preserved.

- **Predicate normalization**: Test lowercase conversion, space-to-underscore, auxiliary verb stripping. Verify that "Was born in" becomes `born_in`, "has founded" becomes `founded`, "is_a" stays `is_a`.

- **Entity resolution**: Test each resolution phase independently: alias match, case-insensitive, substring containment, abbreviation match. Verify merge semantics: canonical name selection, alias merging, triple updating. Test false merge prevention: entities with different types are not merged by substring.

- **Graph operations**: Test `addTriple`, `getEntity`, `getRelationships`, `query` (all 8 wildcard patterns), `findPath` (connected, disconnected, directed, undirected), `getNeighbors`, `getSubgraph`, `merge`, `removeTriple`, `removeEntity`. Test edge cases: empty graph, single-node graph, self-referential triple, duplicate triples.

- **Serialization**: Test JSON round-trip (`toJSON` then `fromJSON` produces identical graph). Test GraphML output is well-formed XML. Test CSV output handles delimiters and newlines in values. Test Cypher output produces valid Cypher syntax.

### Integration Tests

End-to-end tests that run the full pipeline with a mock LLM (a function that returns predetermined JSON responses):

- **Single passage extraction**: Provide a passage and a mock LLM that returns known entities and triples. Verify the `ExtractionResult` matches expectations.

- **Multi-passage graph building**: Provide multiple passages with overlapping entities (the same person mentioned in different passages). Verify that entity resolution merges them correctly and the resulting graph is connected.

- **Graph queries after extraction**: Build a graph from known passages, then run queries (`query`, `findPath`, `getSubgraph`) and verify the results match the expected graph structure.

- **Constrained predicates**: Provide a predicate list and verify that the prompt includes the constraints. Verify that the mock LLM's response (which uses the constrained predicates) is correctly parsed.

- **Custom entity types**: Provide custom types and verify they appear in the prompt and are correctly parsed from the LLM response.

- **Error handling**: Mock an LLM that returns invalid JSON. Verify that the retry mechanism fires and the corrective prompt is sent. Mock an LLM that fails entirely. Verify that an `ExtractionError` is thrown with the correct code.

- **Determinism with mock LLM**: Verify that the same input with the same mock LLM produces identical output.

### Edge Case Tests

- Empty text input.
- Text with no extractable entities ("The weather was nice today.").
- Text in non-English languages (the LLM may still extract entities, but results depend on the model).
- Very long text (exceeds `maxPassageTokens` -- verify splitting occurs).
- Text with heavily nested relationships ("A, who founded B, which acquired C, that operates in D").
- Entities with special characters (accented characters, apostrophes, hyphens: "O'Brien", "Hewlett-Packard", "Sao Paulo").
- Duplicate triples within a single passage.
- Self-referential triple (subject == object).
- Graph with no edges (entities extracted but no relationships).
- Graph with a single entity.

### Test Framework

Tests use Vitest, matching the project's existing configuration in `package.json`. The mock LLM returns deterministic responses, eliminating API cost and non-determinism from the test suite. No real LLM calls are made during automated testing.

---

## 17. Performance

### Performance Characteristics

`kg-extract` performance is dominated by LLM call latency. Graph operations are fast (milliseconds); LLM calls take 1-10 seconds each. The primary performance optimization is minimizing the number of LLM calls and maximizing their parallelism.

### LLM Call Budget

| Extraction Mode | LLM Calls per Passage | Description |
|----------------|----------------------|-------------|
| Two-step (default) | 2 | 1 for entity extraction + 1 for relationship extraction |
| Combined | 1 | Entities and relationships in a single call |
| Two-step + retry | 3-4 | 2 base calls + 1-2 retries for parse failures |

For a document split into N passages:
- **Two-step mode**: 2N LLM calls.
- **Combined mode**: N LLM calls.
- **Concurrency**: Up to `concurrency` (default: 3) LLM calls run in parallel, reducing wall-clock time to `ceil(totalCalls / concurrency) * avgCallLatency`.

### Performance Estimates

Assuming 2 seconds average LLM call latency, two-step extraction, concurrency of 3:

| Input Size | Passages | LLM Calls | Wall-Clock Time |
|-----------|----------|-----------|-----------------|
| 1 paragraph (200 words) | 1 | 2 | ~4s |
| 1 page (500 words) | 1 | 2 | ~4s |
| 5 pages (2500 words) | 3 | 6 | ~4s (3 parallel) |
| 20 pages (10,000 words) | 10 | 20 | ~14s |
| 100 pages (50,000 words) | 50 | 100 | ~68s |

With `combinedExtraction: true`, halve the LLM call count and roughly halve the wall-clock time.

### Graph Operation Performance

Graph operations are in-memory and fast:

| Operation | Time Complexity | Typical Latency (1000 nodes, 5000 edges) |
|-----------|----------------|------------------------------------------|
| `addTriple` | O(1) amortized | < 0.01ms |
| `getEntity` | O(1) | < 0.01ms |
| `query(S, *, *)` | O(degree) | < 0.1ms |
| `query(*, P, *)` | O(edges with predicate P) | < 1ms |
| `query(*, *, *)` | O(E) | < 5ms |
| `findPath` (depth 10) | O(V + E) | < 5ms |
| `getSubgraph` (depth 2) | O(reachable V + E) | < 1ms |
| `stats()` (with components) | O(V + E) | < 5ms |
| `toJSON` | O(V + E) | < 10ms |
| `toCypher` | O(V + E) | < 10ms |

### Memory Usage

The in-memory graph stores entities and edges as JavaScript objects. Memory usage scales linearly with graph size:

| Graph Size | Entities | Triples | Approximate Memory |
|-----------|----------|---------|-------------------|
| Small | 50 | 200 | ~100 KB |
| Medium | 500 | 2,000 | ~1 MB |
| Large | 5,000 | 20,000 | ~10 MB |
| Very large | 50,000 | 200,000 | ~100 MB |

For graphs exceeding ~50,000 entities, consider exporting to Neo4j or another graph database rather than holding the entire graph in memory.

---

## 18. Dependencies

### Runtime Dependencies

**Zero mandatory runtime dependencies.** All prompt templates, JSON parsers, graph data structures, traversal algorithms, normalization routines, and serialization formats are implemented in pure TypeScript.

The LLM is provided by the caller. `kg-extract` does not depend on `openai`, `@anthropic-ai/sdk`, or any other LLM client library. The adapter factories in `adapters` are thin wrappers that type-check against the caller's existing client instance -- they do not import the client libraries themselves.

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `eslint` | Linting |

### Peer Dependencies

None.

### Why Zero Dependencies

Knowledge graph extraction is an orchestration problem: format prompts, call an LLM, parse the output, assemble a graph. None of these steps require external libraries:
- Prompt templates are string concatenation.
- JSON parsing uses the built-in `JSON.parse` with pre-processing.
- Graph data structures are Maps and arrays.
- BFS/DFS are standard algorithms.
- Serialization (JSON, XML, CSV, Cypher) is string building.

Adding dependencies for any of these would increase install size, introduce supply chain risk, and constrain the package's compatibility surface -- all for functionality that is straightforward to implement in 50-200 lines of TypeScript per feature.

---

## 19. File Structure

```
kg-extract/
├── package.json
├── tsconfig.json
├── SPEC.md
├── README.md
├── src/
│   ├── index.ts                  # Public API exports: extract, buildGraph,
│   │                             #   createExtractor, KnowledgeGraph, adapters, types
│   ├── extract.ts                # extract() function: single-text extraction pipeline
│   ├── build-graph.ts            # buildGraph() function: multi-text pipeline + resolution
│   ├── factory.ts                # createExtractor() factory function
│   ├── types.ts                  # All TypeScript type definitions
│   ├── errors.ts                 # ExtractionError class
│   ├── prompts/
│   │   ├── entity-prompt.ts      # Entity extraction prompt template construction
│   │   ├── relationship-prompt.ts # Relationship extraction prompt template construction
│   │   └── examples.ts           # Built-in few-shot examples
│   ├── parse/
│   │   ├── json-parser.ts        # Robust JSON output parser (heuristic fixes)
│   │   ├── entity-validator.ts   # Entity validation and normalization
│   │   └── triple-validator.ts   # Triple validation and normalization
│   ├── normalize/
│   │   ├── entity-name.ts        # Entity name normalization (casing, whitespace, articles)
│   │   └── predicate.ts          # Predicate normalization (lowercase, underscores, aux verbs)
│   ├── resolve/
│   │   ├── resolver.ts           # Entity resolution orchestration
│   │   ├── alias-match.ts        # Phase 1: alias-based merging
│   │   ├── case-match.ts         # Phase 2: case-insensitive matching
│   │   ├── substring-match.ts    # Phase 3: substring containment matching
│   │   └── abbreviation-match.ts # Phase 4: abbreviation detection
│   ├── graph/
│   │   ├── knowledge-graph.ts    # KnowledgeGraph class implementation
│   │   ├── query.ts              # Pattern-based triple query engine
│   │   ├── path.ts               # BFS path finding
│   │   ├── subgraph.ts           # Subgraph extraction
│   │   └── stats.ts              # Graph statistics computation
│   ├── serialize/
│   │   ├── json.ts               # JSON export/import
│   │   ├── graphml.ts            # GraphML export
│   │   ├── csv.ts                # CSV/TSV triple export
│   │   └── cypher.ts             # Cypher statement export
│   ├── adapters/
│   │   ├── index.ts              # Adapter exports
│   │   ├── openai.ts             # OpenAI adapter factory
│   │   └── anthropic.ts          # Anthropic adapter factory
│   └── split/
│       └── passage-splitter.ts   # Built-in passage splitter (paragraph + sentence)
├── src/__tests__/
│   ├── extract.test.ts           # Integration tests for extract()
│   ├── build-graph.test.ts       # Integration tests for buildGraph()
│   ├── prompts/
│   │   ├── entity-prompt.test.ts
│   │   └── relationship-prompt.test.ts
│   ├── parse/
│   │   ├── json-parser.test.ts
│   │   ├── entity-validator.test.ts
│   │   └── triple-validator.test.ts
│   ├── normalize/
│   │   ├── entity-name.test.ts
│   │   └── predicate.test.ts
│   ├── resolve/
│   │   ├── resolver.test.ts
│   │   └── alias-match.test.ts
│   ├── graph/
│   │   ├── knowledge-graph.test.ts
│   │   ├── query.test.ts
│   │   ├── path.test.ts
│   │   └── subgraph.test.ts
│   ├── serialize/
│   │   ├── json.test.ts
│   │   ├── graphml.test.ts
│   │   ├── csv.test.ts
│   │   └── cypher.test.ts
│   └── fixtures/
│       ├── mock-llm.ts           # Deterministic mock LLM for testing
│       ├── passages/             # Sample text passages
│       └── expected/             # Expected extraction results
└── dist/                         # Compiled output (generated by tsc)
```

---

## 20. Implementation Roadmap

### Phase 1: Core Extraction Pipeline (v0.1.0)

Implement the foundation: types, LLM interface, entity extraction, relationship extraction, and JSON output parsing.

**Deliverables:**
1. **Types**: Define all TypeScript types in `types.ts` -- `Entity`, `Triple`, `ExtractionResult`, `ExtractOptions`, `LLM`, `LLMMessage`, and all supporting types.
2. **LLM interface**: Implement the pluggable LLM interface with simple function and message-based variants in `extract.ts`. Implement LLM function detection (string vs message-based).
3. **Entity extraction prompt**: Implement the entity extraction prompt template in `prompts/entity-prompt.ts` with built-in few-shot examples.
4. **Relationship extraction prompt**: Implement the relationship extraction prompt template in `prompts/relationship-prompt.ts` with entity list injection.
5. **JSON output parser**: Implement the robust JSON parser in `parse/json-parser.ts` with all heuristic fixes (markdown stripping, single quotes, trailing commas).
6. **Entity and triple validation**: Implement validators in `parse/entity-validator.ts` and `parse/triple-validator.ts`.
7. **Pipeline orchestration**: Implement `extract()` with two-step extraction (entity then relationship) and combined extraction mode.
8. **Error handling**: Implement `ExtractionError` and the retry mechanism.
9. **Public API**: Export `extract()` from `index.ts`.
10. **Tests**: Unit tests for prompt construction, JSON parsing, validation. Integration test with mock LLM.

### Phase 2: Normalization and Entity Resolution (v0.2.0)

Add triple normalization and entity resolution for multi-passage extraction.

**Deliverables:**
1. **Entity name normalization**: Implement casing, whitespace, and article normalization in `normalize/entity-name.ts`.
2. **Predicate normalization**: Implement lowercase, underscore, and auxiliary verb stripping in `normalize/predicate.ts`.
3. **Entity resolution**: Implement all four resolution phases in `resolve/`. Implement configurable resolution options.
4. **Entity resolver hook**: Implement the `entityResolver` option for pluggable external resolution.
5. **Passage splitter**: Implement the built-in paragraph-boundary splitter in `split/passage-splitter.ts`.
6. **`buildGraph()`**: Implement multi-passage extraction with concurrency, normalization, resolution, and graph assembly.
7. **Public API**: Export `buildGraph()` from `index.ts`.
8. **Tests**: Unit tests for each normalization and resolution phase. Integration test for multi-passage graph building.

### Phase 3: KnowledgeGraph Class (v0.3.0)

Implement the full in-memory graph with query, traversal, and statistics.

**Deliverables:**
1. **KnowledgeGraph class**: Implement adjacency list data structure, `addTriple`, `addEntity`, `getEntity`, `getRelationships`, `removeTriple`, `removeEntity` in `graph/knowledge-graph.ts`.
2. **Query engine**: Implement pattern-based triple matching with wildcards and predicate index in `graph/query.ts`.
3. **Path finding**: Implement BFS shortest path with directed/undirected modes in `graph/path.ts`.
4. **Subgraph extraction**: Implement N-hop subgraph extraction in `graph/subgraph.ts`.
5. **Graph statistics**: Implement node count, edge count, connected components, degree distribution in `graph/stats.ts`.
6. **Graph merging**: Implement `merge()` with entity deduplication and triple deduplication.
7. **Tests**: Unit tests for all graph operations. Edge case tests (empty graph, self-referential, disconnected).

### Phase 4: Serialization and Adapters (v0.4.0)

Add serialization formats and LLM adapter factories.

**Deliverables:**
1. **JSON export/import**: Implement `toJSON()` and `KnowledgeGraph.fromJSON()` in `serialize/json.ts`.
2. **GraphML export**: Implement `toGraphML()` in `serialize/graphml.ts`.
3. **CSV/TSV export**: Implement `toCSV()` and `toTSV()` in `serialize/csv.ts`.
4. **Cypher export**: Implement `toCypher()` in `serialize/cypher.ts`.
5. **OpenAI adapter**: Implement `adapters.openai()` in `adapters/openai.ts`.
6. **Anthropic adapter**: Implement `adapters.anthropic()` in `adapters/anthropic.ts`.
7. **`createExtractor()` factory**: Implement the factory function in `factory.ts`.
8. **Tests**: Serialization round-trip tests (JSON), well-formedness tests (GraphML, Cypher). Adapter type-checking tests.

### Phase 5: Configuration, Integration, and Polish (v1.0.0)

Production-ready release with full configuration, custom prompt support, and ecosystem integration.

**Deliverables:**
1. **Custom prompt templates**: Implement the `promptTemplates` option.
2. **Custom entity types and predicate constraints**: Wire through to prompt construction.
3. **Structured output mode**: Implement the `structuredOutput` option.
4. **Confidence filtering**: Implement `minConfidence` threshold.
5. **Filtered queries**: Implement `QueryOptions.filter` and `QueryOptions.limit`.
6. **Entity type queries**: Implement `getEntitiesByType()` with type index.
7. **Integration examples**: Write and test integration code for `entity-resolve`, `embed-cache`, `rag-prompt-builder`, and `chunk-smart`.
8. **Performance benchmarks**: Measure graph operation latency for various graph sizes. Document in README.
9. **README**: Comprehensive README with quick start, API reference, and examples.
10. **Full test suite**: All unit tests, integration tests, and edge case tests passing.

---

## 21. Example Use Cases

### Document Knowledge Graph Extraction

A legal team has 500 contract documents. They need to understand the relationship network: which companies contract with which other companies, who are the signatories, what are the contract dates and values, which law firms are involved. They process each document through `kg-extract`, building a knowledge graph with entities of type Company, Person, Date, and custom types like ContractValue and LawFirm. The resulting graph answers questions like "Show all contracts involving Company X", "Who are the most common signatories across all contracts?", and "Which law firms appear in contracts with Company Y?"

### GraphRAG Pipeline

A research team builds a question-answering system over a corpus of scientific papers. Traditional vector-similarity RAG retrieves relevant passages but struggles with multi-hop questions ("Which institutions have researchers who contributed to both CRISPR and mRNA vaccine development?"). They use `kg-extract` to build a knowledge graph from the paper abstracts, extracting researchers, institutions, technologies, and their relationships. At query time, they identify the key entities in the question, extract the relevant subgraph, and include it as structured context in the LLM prompt. The graph structure enables multi-hop traversal that vector similarity cannot provide.

### Entity Relationship Visualization

A journalism team investigates financial relationships between politicians and corporations. They process public disclosure documents, news articles, and campaign finance records through `kg-extract`. The resulting knowledge graph captures entities (politicians, corporations, lobbying firms, PACs) and relationships (donated_to, lobbied_for, board_member_of, invested_in). They export the graph to GraphML and visualize it in Gephi, revealing clusters of interconnected entities and identifying previously unknown connections.

### Structured Knowledge Base from Unstructured Text

A product team maintains a customer support knowledge base as a collection of unstructured wiki articles. They want to convert this into a structured knowledge base that can answer questions precisely. They run the articles through `kg-extract` with custom entity types (Product, Feature, ErrorCode, ConfigOption) and constrained predicates (has_feature, causes_error, resolves_error, configured_by). The resulting graph powers a support chatbot that can traverse relationships ("Product X has_feature Y, Y causes_error Z, Z resolves_error by ConfigOption W") to provide precise troubleshooting steps.

### Competitive Intelligence

A strategy team monitors competitor activities by processing news articles, press releases, and earnings call transcripts. They use `kg-extract` to build a knowledge graph of the competitive landscape: companies, products, executives, partnerships, acquisitions, market entries. The graph is updated weekly as new articles are processed and merged into the existing graph. Queries like "What partnerships has Competitor X announced in the last quarter?" and "Which executives have moved between these three companies?" are answered directly from the graph structure.
