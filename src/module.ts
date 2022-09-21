import { Index } from "./collections/index.js"
import { QuadSet } from "./collections/data-set.js"
import { VTMap } from "./collections/var-tracking.js"
import { Parser } from "./parser/parser.js"
import { NamedNode } from "./term.js"
import { A, namedNode, Prefixers } from "./data-factory.js"
import { Store } from "./store.js"
import { Clause } from "./clause.js"

const { fpc } = Prefixers

export class Module {
  static parse(store: Store, source: string): void {
    const parser = new Parser(source)
    parser.parse(new Index(['SPO', 'POS']))
    new Module(store, namedNode(parser.namespace.base), parser.output!)
  }

  signature = new Signature()

  constructor(store: Store, public name: NamedNode, public facts: Index = new Index()) {
    store.modules.set(name, this)
    const rules = this.facts.getRoot('POS').get(A)?.get(fpc('Rule'))
    if (!rules) return
    for (const r of rules) {
      const clauses = this.facts.getRoot('SPO').get(r)?.get(fpc('clause'))
      if (!clauses) continue
      for (const c of clauses) new Clause(store, this, c)
    }
  }
}

class Signature extends QuadSet {
  protected Branch = VTMap
  constructor() {
    super('SPOG')
  }
}
