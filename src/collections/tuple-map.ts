export {set} from './tree.js'
import * as tree from './tree.js'

export type TupleMap<K, V> = tree.Tree<K, V>

// Just for the 'as'
export function get<K, V>(
  map: TupleMap<K, V>,
  key: Iterable<K>,
): V | undefined {
  return tree.get(map, key) as V | undefined
}

export function remove<K, V>(map: TupleMap<K, V>, key: Iterable<K>): void {
  tree.prune(map, key, () => true)
}
