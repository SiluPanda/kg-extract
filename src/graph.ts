import type { Entity, Triple, GraphStats, GraphJSON } from './types.js'

interface GraphNode {
  entity: Entity
  outgoing: Triple[]
  incoming: Triple[]
}

export class KnowledgeGraph {
  private entityMap = new Map<string, GraphNode>()
  private _triples: Triple[] = []

  addEntity(entity: Entity): void {
    const key = entity.name.toLowerCase()
    if (!this.entityMap.has(key)) {
      this.entityMap.set(key, { entity, outgoing: [], incoming: [] })
    }
  }

  addTriple(triple: Triple): void {
    this._triples.push(triple)
    // Ensure entities exist
    if (!this.entityMap.has(triple.subject.toLowerCase())) {
      this.addEntity({ name: triple.subject, type: 'unknown' })
    }
    if (!this.entityMap.has(triple.object.toLowerCase())) {
      this.addEntity({ name: triple.object, type: 'unknown' })
    }
    this.entityMap.get(triple.subject.toLowerCase())?.outgoing.push(triple)
    this.entityMap.get(triple.object.toLowerCase())?.incoming.push(triple)
  }

  getEntity(name: string): Entity | undefined {
    return this.entityMap.get(name.toLowerCase())?.entity
  }

  query(subject?: string, predicate?: string, object?: string): Triple[] {
    return this._triples.filter(t =>
      (!subject || t.subject.toLowerCase() === subject.toLowerCase()) &&
      (!predicate || t.predicate === predicate) &&
      (!object || t.object.toLowerCase() === object.toLowerCase())
    )
  }

  getRelationships(name: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): Triple[] {
    const node = this.entityMap.get(name.toLowerCase())
    if (!node) return []
    if (direction === 'outgoing') return [...node.outgoing]
    if (direction === 'incoming') return [...node.incoming]
    return [...node.outgoing, ...node.incoming]
  }

  getNeighbors(name: string, depth = 1): Entity[] {
    const visited = new Set<string>()
    const result: Entity[] = []
    const queue: Array<{ name: string; d: number }> = [{ name: name.toLowerCase(), d: 0 }]
    while (queue.length > 0) {
      const { name: n, d } = queue.shift()!
      if (visited.has(n) || d > depth) continue
      visited.add(n)
      if (d > 0) {
        const e = this.entityMap.get(n)?.entity
        if (e) result.push(e)
      }
      const node = this.entityMap.get(n)
      if (node) {
        for (const t of [...node.outgoing, ...node.incoming]) {
          const next = t.subject.toLowerCase() === n ? t.object.toLowerCase() : t.subject.toLowerCase()
          if (!visited.has(next)) queue.push({ name: next, d: d + 1 })
        }
      }
    }
    return result
  }

  findPath(from: string, to: string, options?: { maxDepth?: number }): Triple[] | null {
    const maxDepth = options?.maxDepth ?? 5
    const fromKey = from.toLowerCase(), toKey = to.toLowerCase()
    const queue: Array<{ key: string; path: Triple[] }> = [{ key: fromKey, path: [] }]
    const visited = new Set<string>()
    while (queue.length > 0) {
      const { key, path } = queue.shift()!
      if (key === toKey) return path
      if (visited.has(key) || path.length >= maxDepth) continue
      visited.add(key)
      const node = this.entityMap.get(key)
      if (node) {
        for (const t of node.outgoing) {
          queue.push({ key: t.object.toLowerCase(), path: [...path, t] })
        }
      }
    }
    return null
  }

  *entities(): Iterable<Entity> {
    for (const { entity } of this.entityMap.values()) yield entity
  }

  *triples(): Iterable<Triple> {
    yield* this._triples
  }

  getEntitiesByType(type: string): Entity[] {
    return [...this.entities()].filter(e => e.type.toLowerCase() === type.toLowerCase())
  }

  stats(): GraphStats {
    const entityTypes: Record<string, number> = {}
    const predicates: Record<string, number> = {}
    let maxDegree = 0, mostConnected = ''
    for (const { entity, outgoing, incoming } of this.entityMap.values()) {
      entityTypes[entity.type] = (entityTypes[entity.type] ?? 0) + 1
      const deg = outgoing.length + incoming.length
      if (deg > maxDegree) { maxDegree = deg; mostConnected = entity.name }
    }
    for (const t of this._triples) predicates[t.predicate] = (predicates[t.predicate] ?? 0) + 1
    const avgDegree = this.entityMap.size > 0 ? (this._triples.length * 2) / this.entityMap.size : 0
    return {
      nodeCount: this.entityMap.size,
      edgeCount: this._triples.length,
      avgDegree,
      maxDegree,
      mostConnected,
      entityTypes,
      predicates,
    }
  }

  merge(other: KnowledgeGraph): void {
    for (const e of other.entities()) this.addEntity(e)
    for (const t of other.triples()) this.addTriple(t)
  }

  toJSON(): GraphJSON {
    return {
      entities: [...this.entities()].map(e => ({
        name: e.name,
        type: e.type,
        aliases: e.aliases ?? [],
        properties: e.properties ?? {},
      })),
      triples: this._triples,
      metadata: {
        createdAt: new Date().toISOString(),
        entityCount: this.entityMap.size,
        tripleCount: this._triples.length,
      },
    }
  }

  static fromJSON(json: GraphJSON): KnowledgeGraph {
    const kg = new KnowledgeGraph()
    for (const e of json.entities) kg.addEntity(e)
    for (const t of json.triples) kg.addTriple(t)
    return kg
  }
}
