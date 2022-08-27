import { get } from './defaulting.js'
import { fillTwig, prune, Tree } from './tree.js'

export type TupleMultiSet<K> = Tree<K, Map<K, Count>>

// TS gets confused when I try to make the V arg to Tree a Map<Term, number>;
// boxing this value means the rest of our machinery will work if we just say
// this is the leaf
class Count {
  value: number = 0

  increment(): void {
    this.value++
  }

  decrement(): void {
    this.value--
  }
}

export function add<K>(set: TupleMultiSet<K>, tuple: K[]): void {
  fillTwig(set, tuple, (b, k) => get(b, k, () => new Count())).increment()
}

export function remove<K>(set: TupleMultiSet<K>, tuple: K[]): void {
  prune(set, tuple, (leaf: Count) => {
    leaf.decrement()
    return leaf.value === 0
  })
}
