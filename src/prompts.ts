import type { Entity } from './types.js'

export function entityExtractionPrompt(passage: string, entityTypes?: string[]): string {
  const types = entityTypes?.join(', ') ?? 'Person, Organization, Location, Date, Event, Concept, Product'
  return `Extract all named entities from the text below. For each entity, output one line:
ENTITY: <name> | <type> | <aliases if any, comma separated>

Entity types to look for: ${types}
Only include types from the list above. Skip pronouns and generic nouns.

Text:
${passage}

Entities (one per line):`
}

export function relationshipExtractionPrompt(passage: string, entities: Entity[]): string {
  const entityList = entities.map(e => `- ${e.name} (${e.type})`).join('\n')
  return `Given these entities:
${entityList}

Extract relationships between them from the text below. Output one per line:
TRIPLE: <subject> | <predicate> | <object> | <confidence 0.0-1.0>

Use short, specific predicates (e.g., "founded", "works_at", "located_in", "acquired").

Text:
${passage}

Triples (one per line):`
}
