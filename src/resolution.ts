import type { Entity, Triple } from './types.js'

export function resolveEntities(entities: Entity[]): { resolved: Entity[]; mergeMap: Map<string, string> } {
  const mergeMap = new Map<string, string>() // alias → canonical name
  const canonical: Entity[] = []

  // Phase 1: Exact name matching (case-insensitive)
  const byNormalizedName = new Map<string, Entity>()
  for (const e of entities) {
    const key = e.name.toLowerCase().trim()
    if (!byNormalizedName.has(key)) {
      byNormalizedName.set(key, e)
      canonical.push(e)
    } else {
      const existing = byNormalizedName.get(key)!
      mergeMap.set(e.name, existing.name)
      existing.aliases = [...new Set([...(existing.aliases ?? []), e.name, ...(e.aliases ?? [])])]
    }
  }

  // Phase 2: Alias-based merging
  for (const e of canonical) {
    for (const alias of e.aliases ?? []) {
      const key = alias.toLowerCase().trim()
      const other = byNormalizedName.get(key)
      if (other && other !== e) {
        mergeMap.set(other.name, e.name)
        e.aliases = [...new Set([...(e.aliases ?? []), ...(other.aliases ?? [])])]
      }
    }
  }

  // Phase 3: Substring matching (if one entity name contains another, length >= 5)
  for (let i = 0; i < canonical.length; i++) {
    for (let j = i + 1; j < canonical.length; j++) {
      const a = canonical[i], b = canonical[j]
      const aLower = a.name.toLowerCase(), bLower = b.name.toLowerCase()
      if (aLower.length >= 5 && bLower.includes(aLower)) {
        mergeMap.set(b.name, a.name)
      } else if (bLower.length >= 5 && aLower.includes(bLower)) {
        mergeMap.set(a.name, b.name)
      }
    }
  }

  return { resolved: canonical.filter(e => !mergeMap.has(e.name)), mergeMap }
}

export function resolveTriples(triples: Triple[], mergeMap: Map<string, string>): Triple[] {
  return triples.map(t => ({
    ...t,
    subject: mergeMap.get(t.subject) ?? t.subject,
    object: mergeMap.get(t.object) ?? t.object,
  }))
}
