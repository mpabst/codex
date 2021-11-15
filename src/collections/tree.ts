import * as defaulting from './defaulting.js'

export type Tree<K, V> = Map<K, V | Tree<K, V>>

export function clone<K, V>(
  source: Tree<K, V>,
  leafCloner = (v: V) => v
): Tree<K, V> {
  const dest: Tree<K, V> = new Map()
  for (const [k, v] of source)
    dest.set(k, v instanceof Map ? (clone(v) as Map<K, V>) : leafCloner(v))
  return dest
}

export function get<K, V>(
  tree: Tree<K, V>,
  key: Iterable<K>
): V | Tree<K, V> | undefined {
  const [first, ...rest] = key
  if (!tree.has(first)) return
  const found = tree.get(first)
  if (rest.length === 0) return found as V
  return get(found as Tree<K, V>, rest)
}

export function fillTwig<K, V, M>(
  tree: Tree<K, V>,
  key: Iterable<K>,
  doer: (t: Map<K, V>, k: K) => M
): M {
  return twigBase(tree, key, doer, true)!
}

export function has<K, V>(tree: Tree<K, V>, key: Iterable<K>): boolean {
  const [first, ...rest] = key
  if (!tree.has(first)) return false
  if (rest.length === 0) return true
  return has(tree.get(first)! as Tree<K, V>, rest)
}

// Return value is whether the tree parameter is empty after we're done with it,
// meaning our caller can safely delete it
export function prune<K, V>(
  tree: Tree<K, V> | undefined,
  key: Iterable<K>,
  pruneLeaf: (l: V) => boolean
): boolean {
  if (!tree) return true
  const [first, ...rest] = key
  if (rest.length === 0) {
    const leaf = tree.get(first) as V
    if (leaf && pruneLeaf(leaf)) tree.delete(first)
  } else if (prune(tree.get(first) as Tree<K, V>, rest, pruneLeaf))
    tree.delete(first)
  return tree.size === 0
}

export function set<K, V>(tree: Tree<K, V>, key: Iterable<K>, value: V): void {
  const [first, ...rest] = key
  if (rest.length === 0) tree.set(first, value)
  else
    set(defaulting.get(tree, first, () => new Map()) as Tree<K, V>, rest, value)
}

export function twig<K, V, M>(
  tree: Tree<K, V>,
  key: Iterable<K>,
  doer: (t: Map<K, V>, k: K) => M
): M | undefined {
  return twigBase(tree, key, doer, false)
}

function twigBase<K, V, M>(
  tree: Tree<K, V>,
  key: Iterable<K>,
  doer: (t: Map<K, V>, k: K) => M,
  fill: boolean
): M | undefined {
  const [first, ...rest] = key
  if (rest.length === 0) return doer(tree as Map<K, V>, first)
  const branch = fill
    ? defaulting.get(tree, first, () => new Map())
    : tree.get(first)
  if (!branch) return
  return twigBase(branch as Tree<K, V>, rest, doer, fill)
}
