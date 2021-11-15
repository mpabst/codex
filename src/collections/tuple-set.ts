import * as defaulting from './defaulting.js'
import { first as iFirst } from './iterable.js'
import { Tree, fillTwig, clone as cloneTree, prune, twig } from './tree.js'

export type TupleSet<K> = Tree<K, Set<K>>

export function add<K>(set: TupleSet<K>, tuple: K[]): void {
  fillTwig(set, butLast(tuple), (b, k) =>
    defaulting.get(b, k, () => new Set())
  ).add(last(tuple))
}

function butLast<K>(tuple: K[]): K[] {
  return tuple.slice(0, -1)
}

export function clone<K>(ts: TupleSet<K>): TupleSet<K> {
  return cloneTree(ts, (s: Set<K>) => new Set(s))
}

export function first<K>(set: TupleSet<K>): K[] | undefined {
  const tuple: K[] = []
  function inner(node: TupleSet<K> | Set<K>) {
    if (node.size === 0) return
    if (node instanceof Set) tuple.push(iFirst(node)!)
    else {
      const [key, val] = iFirst(node.entries())!
      tuple.push(key)
      inner(val)
    }
  }
  inner(set)
  return tuple
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

export function has<K>(set: TupleSet<K>, tuple: K[]): boolean {
  // Could sneak one past the typechecker and just delegate to tree's has(),
  // since our leaf type has a method with the same name and semantics, but ah.
  // If TS could count, it would complain. ^_^
  return Boolean(
    twig(set, butLast(tuple), (b, k) => {
      const leaf = b.get(k)
      return leaf && leaf.has(last(tuple))
    })
  )
}

// OPT: have trees store their size (?), iterate over smaller param
export function intersection<K>(
  left: TupleSet<K>,
  right: TupleSet<K>
): TupleSet<K> {
  const out: TupleSet<K> = new Map()
  forEach(left, l => {
    if (has(right, l)) add(out, l)
  })
  return out
}

function last<K>(tuple: K[]): K {
  return tuple[tuple.length - 1]
}

export function difference<K>(
  left: TupleSet<K>,
  right: TupleSet<K>
): TupleSet<K> {
  const out: TupleSet<K> = new Map()
  forEach(left, (l: K[]) => {
    if (!has(right, l)) add(out, l)
  })
  return out
}

// export function sum<K>(left: TupleSet<K>, right: TupleSet<K>): TupleSet<K> {
//   const out = clone(left)
//   forEach(right, (r: K[]) => add(out, r))
//   return out
// }

export function remove<K>(set: TupleSet<K>, tuple: K[]): void {
  prune(set, butLast(tuple), (leaf: Set<K>) => {
    leaf.delete(last(tuple))
    return leaf.size === 0
  })
}

export function toArray<K>(set: TupleSet<K>): K[][] {
  const out: K[][] = []
  forEach(set, t => out.push(t))
  return out
}
