import {Clause} from './clause'
import {Store} from './collections/store'
import {BlankNode, NamedNode} from './term'

export type Key = NamedNode | BlankNode
type Context = Clause | Store
type Index = Map<Key, Context>

// make this Store, make Store ... something else. graph?
export class Hub {
  private index: Index = new Map()

  // TODO: add(), takes IRI, ctors Clause(s), Store, etc

  get(term: Key) {
    return this.index.get(term)
  }

  set(term: Key, context: Context) {
    this.index.set(term, context)
  }
}
