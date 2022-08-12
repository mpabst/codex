import { VTIndex } from './collections/var-tracking.js'
import { randomBlankNode, randomString, variable } from './data-factory.js'
import { Bindings, Query } from './query.js'
import { Store } from './store.js'
import { Expression, Head, traverse, VarMap } from './syntax.js'
import { BlankNode, NamedNode, Term, Variable } from './term.js'

export class Clause {
  head = new VTIndex()
  body: Query

  constructor(
    public id: NamedNode | BlankNode,
    store: Store,
    head: Head,
    body: Expression,
  ) {
    this.body = new Query(store, body)

    const headMap: VarMap = new Map()
    const query = this.body
    function mapVar(t: Term): Term {
      if (t.termType === 'Variable') {
        let found = query.varNames.get(t as Variable)
        if (found) return found

        found = headMap.get(t as Variable)
        if (found) return found

        found = variable(randomString())
        headMap.set(t as Variable, found)
        return found

      } else return t
    }
    traverse(head, {
      pattern: expr => this.head.add(expr.terms.slice(1).map(mapVar)),
    })

    store.set(id, this)
  }

  call(): Bindings[] {
    // TODO: check memo
    const out: Bindings[] = []
    this.body.evaluate((b: Bindings) => out.push(b))
    return out
  }

  // bottom-up
  update() {}
}
