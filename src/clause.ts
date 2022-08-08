import { Index } from './collections/index.js'
import { Bindings, Query } from './query.js'
import { Store } from './store.js'
import { Expression, Head, traverse } from './syntax.js'
import { BlankNode, NamedNode } from './term.js'

export class Clause {
  head = new Index()
  body: Query

  constructor(
    public id: NamedNode | BlankNode,
    store: Store,
    head: Head,
    body: Expression,
  ) {
    traverse(head, {
      pattern: (expr) => this.head.add(expr.terms.slice(1)),
    })
    this.body = new Query(store, body)
    store.set(id, this)
  }

  call(bindings: Bindings): Bindings[] {
    // TODO: check memo
    const out: Bindings[] = []
    this.body.evaluate((b: Bindings) => out.push(b), bindings)
    return out
  }

  // bottom-up
  update() {}
}
