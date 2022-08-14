import { Clause } from './clause.js'
import { Index } from './collections/index.js'
import { BlankNode, NamedNode } from './term.js'

export type Key = NamedNode | BlankNode
export type Context = Clause | Index

export class Store {
  private items: Map<Key, Context> = new Map()

  // TODO: add(), takes IRI, ctors Clause(s), Store, etc
  // let Store be just the map, make functions instead of
  // a class? or maybe extend instead of compose

  get(term: Key): Context | undefined {
    return this.items.get(term)
  }

  set(term: Key, context: Context): void {
    this.items.set(term, context)
  }
}
