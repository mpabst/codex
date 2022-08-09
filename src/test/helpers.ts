import { PREFIXES } from '../builders.js'
import { Index } from '../collections/index.js'
import { Bindings } from '../query.js'
import { Key, Store } from '../store.js'
import { FlatQuad, FlatTriple, Term } from '../term.js'

export function buildStore(data: FlatQuad[]) {
  const out = new Store()
  for (const d of data) {
    let context = out.get(d[0] as Key)
    if (!context) {
      context = new Index()
      out.set(d[0] as Key, context)
    }
    ;(context as Index).add(d.slice(1) as FlatTriple)
  }
  return out
}

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
