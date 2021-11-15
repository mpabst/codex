import { Tree, fillTwig } from './tree.js'

export function get<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  let found = map.get(key)
  if (!found) {
    found = factory()
    map.set(key, found)
  }
  return found
}

export function set<K, V>(map: Map<K, V>, key: K, value: V): void {
  map.set(key, value)
}

export const tree = {
  get<K, V>(tree: Tree<K, V>, key: Iterable<K>, factory: () => V): V {
    return fillTwig(tree, key, (t, k) => get(t, k, factory))
  }
}
