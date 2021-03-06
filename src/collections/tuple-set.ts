import * as defaulting from './defaulting.js'
import { Tree, fillTwig, prune } from './tree.js'

export type TupleSet<K> = Tree<K, Set<K>>

export function add<K>(set: TupleSet<K>, tuple: K[]): void {
  fillTwig(set, butLast(tuple), (b, k) =>
    defaulting.get(b, k, () => new Set()),
  ).add(last(tuple))
}

function butLast<K>(tuple: K[]): K[] {
  return tuple.slice(0, -1)
}

export function forEach<K>(set: TupleSet<K>, cb: (t: K[]) => void): void {
  const tuple: K[] = []
  function inner(node: TupleSet<K> | Set<K>) {
    if (node instanceof Set)
      for (const n of node) {
        tuple.push(n)
        cb([...tuple])
        tuple.pop()
      }
    else
      for (const [k, v] of node) {
        tuple.push(k)
        inner(v)
        tuple.pop()
      }
  }
  inner(set)
}

function last<K>(tuple: K[]): K {
  return tuple[tuple.length - 1]
}

export function remove<K>(set: TupleSet<K>, tuple: K[]): void {
  prune(set, butLast(tuple), (leaf: Set<K>) => {
    leaf.delete(last(tuple))
    return leaf.size === 0
  })
}
