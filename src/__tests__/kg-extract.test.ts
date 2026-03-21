import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseEntities, parseTriples } from '../parser.js'
import { resolveEntities } from '../resolution.js'
import { KnowledgeGraph } from '../graph.js'
import { extract, buildGraph } from '../extract.js'

// ---------------------------------------------------------------------------
// parseEntities
// ---------------------------------------------------------------------------
describe('parseEntities', () => {
  it('parses valid ENTITY lines', () => {
    const output = 'ENTITY: Alice | Person |\nENTITY: Acme Corp | Organization |'
    const entities = parseEntities(output)
    expect(entities).toHaveLength(2)
    expect(entities[0]).toMatchObject({ name: 'Alice', type: 'Person', aliases: [] })
    expect(entities[1]).toMatchObject({ name: 'Acme Corp', type: 'Organization', aliases: [] })
  })

  it('parses aliases when present', () => {
    const output = 'ENTITY: International Business Machines | Organization | IBM, Big Blue'
    const entities = parseEntities(output)
    expect(entities[0].aliases).toEqual(['IBM', 'Big Blue'])
  })

  it('ignores lines that do not start with ENTITY:', () => {
    const output = 'Some random text\nENTITY: Bob | Person |\nAnother line'
    const entities = parseEntities(output)
    expect(entities).toHaveLength(1)
    expect(entities[0].name).toBe('Bob')
  })

  it('returns empty array for empty output', () => {
    expect(parseEntities('')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// parseTriples
// ---------------------------------------------------------------------------
describe('parseTriples', () => {
  it('parses valid TRIPLE lines', () => {
    const output = 'TRIPLE: Alice | works_at | Acme Corp | 0.9'
    const triples = parseTriples(output, 0.3)
    expect(triples).toHaveLength(1)
    expect(triples[0]).toMatchObject({
      subject: 'Alice',
      predicate: 'works_at',
      object: 'Acme Corp',
      confidence: 0.9,
    })
  })

  it('normalises predicate to snake_case lowercase', () => {
    const output = 'TRIPLE: Alice | Works At | Acme Corp | 0.8'
    const triples = parseTriples(output, 0.3)
    expect(triples[0].predicate).toBe('works_at')
  })

  it('filters triples below minConfidence', () => {
    const output = 'TRIPLE: Alice | works_at | Acme Corp | 0.2\nTRIPLE: Alice | founded | Acme Corp | 0.9'
    const triples = parseTriples(output, 0.3)
    expect(triples).toHaveLength(1)
    expect(triples[0].predicate).toBe('founded')
  })

  it('ignores lines that do not start with TRIPLE:', () => {
    const output = 'Random\nTRIPLE: A | b | C | 0.7'
    expect(parseTriples(output, 0.0)).toHaveLength(1)
  })

  it('returns empty array for empty output', () => {
    expect(parseTriples('', 0.3)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// resolveEntities
// ---------------------------------------------------------------------------
describe('resolveEntities', () => {
  it('merges case-insensitive duplicates', () => {
    const entities = [
      { name: 'Alice', type: 'Person' },
      { name: 'alice', type: 'Person' },
    ]
    const { resolved, mergeMap } = resolveEntities(entities)
    expect(resolved).toHaveLength(1)
    expect(mergeMap.get('alice')).toBe('Alice')
  })

  it('keeps distinct entities intact', () => {
    const entities = [
      { name: 'Alice', type: 'Person' },
      { name: 'Bob', type: 'Person' },
    ]
    const { resolved } = resolveEntities(entities)
    expect(resolved).toHaveLength(2)
  })

  it('merges via alias matching', () => {
    const entities = [
      { name: 'International Business Machines', type: 'Organization', aliases: ['IBM'] },
      { name: 'IBM', type: 'Organization', aliases: [] },
    ]
    const { resolved, mergeMap } = resolveEntities(entities)
    // IBM is aliased under International Business Machines, so only one canonical entity
    expect(mergeMap.size).toBeGreaterThanOrEqual(1)
    // The merged canonical list should not include both as independent entries
    const names = resolved.map(e => e.name)
    expect(names).not.toContain('IBM') // IBM merged into International Business Machines
  })
})

// ---------------------------------------------------------------------------
// KnowledgeGraph
// ---------------------------------------------------------------------------
describe('KnowledgeGraph', () => {
  let kg: KnowledgeGraph

  beforeEach(() => {
    kg = new KnowledgeGraph()
  })

  it('addEntity / getEntity round-trip', () => {
    kg.addEntity({ name: 'Alice', type: 'Person' })
    expect(kg.getEntity('Alice')).toMatchObject({ name: 'Alice', type: 'Person' })
    expect(kg.getEntity('alice')).toMatchObject({ name: 'Alice', type: 'Person' })
    expect(kg.getEntity('nobody')).toBeUndefined()
  })

  it('addTriple auto-creates missing entity nodes', () => {
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })
    expect(kg.getEntity('Alice')).toBeDefined()
    expect(kg.getEntity('Acme Corp')).toBeDefined()
  })

  it('query filters by subject', () => {
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })
    kg.addTriple({ subject: 'Bob', predicate: 'works_at', object: 'Acme Corp', confidence: 0.8 })
    const results = kg.query('Alice')
    expect(results).toHaveLength(1)
    expect(results[0].subject).toBe('Alice')
  })

  it('query filters by predicate', () => {
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })
    kg.addTriple({ subject: 'Alice', predicate: 'founded', object: 'StartupX', confidence: 0.7 })
    expect(kg.query(undefined, 'works_at')).toHaveLength(1)
    expect(kg.query(undefined, 'founded')).toHaveLength(1)
  })

  it('query filters by object', () => {
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })
    kg.addTriple({ subject: 'Bob', predicate: 'works_at', object: 'OtherCo', confidence: 0.8 })
    expect(kg.query(undefined, undefined, 'Acme Corp')).toHaveLength(1)
  })

  it('getRelationships returns correct triples', () => {
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })
    kg.addTriple({ subject: 'Bob', predicate: 'manages', object: 'Alice', confidence: 0.8 })

    const outgoing = kg.getRelationships('Alice', 'outgoing')
    expect(outgoing).toHaveLength(1)
    expect(outgoing[0].predicate).toBe('works_at')

    const incoming = kg.getRelationships('Alice', 'incoming')
    expect(incoming).toHaveLength(1)
    expect(incoming[0].predicate).toBe('manages')

    const both = kg.getRelationships('Alice', 'both')
    expect(both).toHaveLength(2)
  })

  it('getRelationships returns empty array for unknown entity', () => {
    expect(kg.getRelationships('nobody')).toEqual([])
  })

  it('findPath finds BFS path between two nodes', () => {
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })
    kg.addTriple({ subject: 'Acme Corp', predicate: 'located_in', object: 'New York', confidence: 0.85 })

    const path = kg.findPath('Alice', 'New York')
    expect(path).not.toBeNull()
    expect(path).toHaveLength(2)
    expect(path![0].predicate).toBe('works_at')
    expect(path![1].predicate).toBe('located_in')
  })

  it('findPath returns null when no path exists', () => {
    kg.addEntity({ name: 'Alice', type: 'Person' })
    kg.addEntity({ name: 'Bob', type: 'Person' })
    expect(kg.findPath('Alice', 'Bob')).toBeNull()
  })

  it('findPath returns empty array for same-node query', () => {
    kg.addEntity({ name: 'Alice', type: 'Person' })
    expect(kg.findPath('Alice', 'Alice')).toEqual([])
  })

  it('stats() returns correct counts', () => {
    kg.addEntity({ name: 'Alice', type: 'Person' })
    kg.addEntity({ name: 'Acme Corp', type: 'Organization' })
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })

    const s = kg.stats()
    expect(s.nodeCount).toBe(2)
    expect(s.edgeCount).toBe(1)
    expect(s.entityTypes['Person']).toBe(1)
    expect(s.entityTypes['Organization']).toBe(1)
    expect(s.predicates['works_at']).toBe(1)
    expect(s.avgDegree).toBe(1) // (1 triple * 2) / 2 nodes
    expect(s.maxDegree).toBe(1)
    expect(['Alice', 'Acme Corp']).toContain(s.mostConnected)
  })

  it('toJSON / fromJSON round-trip', () => {
    kg.addEntity({ name: 'Alice', type: 'Person', aliases: ['Al'], properties: { age: 30 } })
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })

    const json = kg.toJSON()
    expect(json.metadata.entityCount).toBe(2)
    expect(json.metadata.tripleCount).toBe(1)

    const kg2 = KnowledgeGraph.fromJSON(json)
    expect(kg2.getEntity('Alice')).toMatchObject({ name: 'Alice', type: 'Person' })
    expect(kg2.query('Alice', 'works_at')).toHaveLength(1)
  })

  it('getEntitiesByType filters correctly', () => {
    kg.addEntity({ name: 'Alice', type: 'Person' })
    kg.addEntity({ name: 'Bob', type: 'Person' })
    kg.addEntity({ name: 'Acme Corp', type: 'Organization' })
    expect(kg.getEntitiesByType('Person')).toHaveLength(2)
    expect(kg.getEntitiesByType('Organization')).toHaveLength(1)
    expect(kg.getEntitiesByType('Location')).toHaveLength(0)
  })

  it('merge() combines two graphs', () => {
    kg.addEntity({ name: 'Alice', type: 'Person' })
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })

    const kg2 = new KnowledgeGraph()
    kg2.addEntity({ name: 'Bob', type: 'Person' })
    kg2.addTriple({ subject: 'Bob', predicate: 'works_at', object: 'Acme Corp', confidence: 0.8 })

    kg.merge(kg2)
    expect(kg.stats().nodeCount).toBe(3)
    expect(kg.stats().edgeCount).toBe(2)
  })

  it('getNeighbors returns neighbors at depth 1', () => {
    kg.addTriple({ subject: 'Alice', predicate: 'works_at', object: 'Acme Corp', confidence: 0.9 })
    kg.addTriple({ subject: 'Alice', predicate: 'knows', object: 'Bob', confidence: 0.7 })

    const neighbors = kg.getNeighbors('Alice', 1)
    const names = neighbors.map(e => e.name)
    expect(names).toContain('Acme Corp')
    expect(names).toContain('Bob')
    expect(names).not.toContain('Alice')
  })
})

// ---------------------------------------------------------------------------
// extract()
// ---------------------------------------------------------------------------
describe('extract()', () => {
  it('calls LLM and returns entities + triples', async () => {
    const mockLLM = vi.fn()
      .mockResolvedValueOnce('ENTITY: Alice | Person |\nENTITY: Acme Corp | Organization |')
      .mockResolvedValueOnce('TRIPLE: Alice | works_at | Acme Corp | 0.9')

    const result = await extract('Alice works at Acme Corp.', { llm: mockLLM })

    expect(result.entities).toHaveLength(2)
    expect(result.triples).toHaveLength(1)
    expect(result.llmCalls).toBe(2)
    expect(result.llmDurationMs).toBeGreaterThanOrEqual(0)
    expect(result.warnings).toEqual([])
    expect(result.text).toBe('Alice works at Acme Corp.')
  })

  it('skips triple call when no entities extracted', async () => {
    const mockLLM = vi.fn().mockResolvedValueOnce('')

    const result = await extract('Nothing here.', { llm: mockLLM })

    expect(result.entities).toHaveLength(0)
    expect(result.triples).toHaveLength(0)
    expect(mockLLM).toHaveBeenCalledTimes(1)
  })

  it('respects minConfidence threshold', async () => {
    const mockLLM = vi.fn()
      .mockResolvedValueOnce('ENTITY: Alice | Person |\nENTITY: Acme Corp | Organization |')
      .mockResolvedValueOnce('TRIPLE: Alice | works_at | Acme Corp | 0.2\nTRIPLE: Alice | founded | Acme Corp | 0.9')

    const result = await extract('Alice works at Acme Corp.', { llm: mockLLM, minConfidence: 0.5 })
    expect(result.triples).toHaveLength(1)
    expect(result.triples[0].predicate).toBe('founded')
  })

  it('passes custom entityTypes to prompt', async () => {
    const mockLLM = vi.fn().mockResolvedValueOnce('')
    await extract('text', { llm: mockLLM, entityTypes: ['Animal', 'Plant'] })
    expect(mockLLM.mock.calls[0][0]).toContain('Animal, Plant')
  })
})

// ---------------------------------------------------------------------------
// buildGraph()
// ---------------------------------------------------------------------------
describe('buildGraph()', () => {
  it('builds a graph from a single text passage', async () => {
    const mockLLM = vi.fn()
      .mockResolvedValueOnce('ENTITY: Alice | Person |\nENTITY: Acme Corp | Organization |')
      .mockResolvedValueOnce('TRIPLE: Alice | works_at | Acme Corp | 0.9')

    const kg = await buildGraph('Alice works at Acme Corp.', { llm: mockLLM })
    expect(kg.getEntity('Alice')).toBeDefined()
    expect(kg.getEntity('Acme Corp')).toBeDefined()
    expect(kg.query('Alice', 'works_at')).toHaveLength(1)
  })

  it('builds a graph from multiple text passages', async () => {
    const mockLLM = vi.fn()
      .mockResolvedValueOnce('ENTITY: Alice | Person |')
      .mockResolvedValueOnce('') // no triples from passage 1
      .mockResolvedValueOnce('ENTITY: Acme Corp | Organization |')
      .mockResolvedValueOnce('') // no triples from passage 2

    const kg = await buildGraph(['Alice is a person.', 'Acme Corp is a company.'], { llm: mockLLM })
    expect(kg.getEntity('Alice')).toBeDefined()
    expect(kg.getEntity('Acme Corp')).toBeDefined()
  })

  it('performs entity resolution by default', async () => {
    const mockLLM = vi.fn()
      .mockResolvedValueOnce('ENTITY: Alice | Person |\nENTITY: alice | Person |')
      .mockResolvedValueOnce('TRIPLE: Alice | same_as | alice | 0.9')

    const kg = await buildGraph('Alice and alice are the same.', { llm: mockLLM })
    // After resolution, only one Alice entity should exist
    const aliceEntities = kg.getEntitiesByType('Person')
    expect(aliceEntities).toHaveLength(1)
  })
})
