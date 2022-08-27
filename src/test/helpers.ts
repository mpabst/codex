import { PREFIXES } from '../builders.js'
import { Bindings } from '../query.js'
import { FlatQuad, Term } from '../term.js'

const prefixes = new Map()
for (const [abbrev, url] of Object.entries(PREFIXES)) prefixes.set(url, abbrev)

export function prefixify({ value }: Term): string {
  for (const [url, abbrev] of prefixes)
    if (value.startsWith(url)) return value.replace(url, abbrev + ':')
  return value
}

export function printBindings(bindings: Bindings): void {
  const out = []
  for (const pair of bindings) out.push(pair.map(prefixify).join(': '))
  console.log(out.join('\n'))
}

export function printQuad(q: FlatQuad): void {
  const out = []
  for (const t of q) out.push(prefixify(t))
  console.log(out.join(' '))
}
