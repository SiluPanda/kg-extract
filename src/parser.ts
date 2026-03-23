import type { Entity, Triple } from './types.js'

export function parseEntities(llmOutput: string): Entity[] {
  const entities: Entity[] = []
  for (const line of llmOutput.split('\n')) {
    const match = line.match(/^ENTITY:\s*([^|]+?)\s*\|\s*([^|]+?)(?:\s*\|\s*(.+?))?\s*\|?\s*$/)
    if (!match) continue
    const [, name, type, aliasStr] = match
    const aliases = aliasStr ? aliasStr.split(',').map(a => a.trim()).filter(Boolean) : []
    const trimmedName = name.trim()
    const trimmedType = type.trim()
    if (trimmedName && trimmedType) entities.push({ name: trimmedName, type: trimmedType, aliases })
  }
  return entities
}

export function parseTriples(llmOutput: string, minConfidence: number): Triple[] {
  const triples: Triple[] = []
  for (const line of llmOutput.split('\n')) {
    const match = line.match(/^TRIPLE:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*([0-9.]+)\s*$/)
    if (!match) continue
    const [, subject, predicate, object, confStr] = match
    const confidence = parseFloat(confStr)
    if (isNaN(confidence) || confidence < minConfidence || confidence > 1.0) continue
    if (subject && predicate && object) {
      triples.push({
        subject: subject.trim(),
        predicate: predicate.trim().replace(/\s+/g, '_').toLowerCase(),
        object: object.trim(),
        confidence,
      })
    }
  }
  return triples
}
