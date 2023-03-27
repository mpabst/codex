import { Branch, Twig } from './collections/data-set.js'
import { Index } from './collections/index.js'
import { Prefixers } from './data-factory.js'
import { A, Name } from './term.js'

const { fpc } = Prefixers

export function traverse(
  context: Index,
  root: Name,
  handlers: { [k: string]: (node: Name) => void },
) {
  const spo = context.getRoot('SPO')
  const stack: (Name | null)[] = [root]
  while (true) {
    const node = stack.pop()!
    if (node === undefined) return
    const po = spo.get(node) as Branch
    const types = po.get(A)!
    if (types.has(fpc('Conjunction')))
      stack.push(...(po.get(fpc('conjunct')) as Twig))
    if (types.has(fpc('Pattern'))) handlers.doPattern(node)
  }
}
