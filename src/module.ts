import { Index } from './collections/index.js'
import { Parser } from './parser/parser.js'
import { Name, NamedNode, Quad } from './term.js'
import { A, namedNode, Prefixers, variable } from './data-factory.js'
import { Store } from './store.js'
import { QuadSet, TripleSet } from './collections/data-set.js'
import { Rule } from './rule.js'
import { Clause } from './clause.js'

const { fpc } = Prefixers

export interface Callable {
  signature: QuadSet
}

export class Module implements Callable {
  static async parse(store: Store, source: string): Promise<Module> {
    const parser = new Parser(source)
    parser.parse(new Index(TripleSet, ['SPO', 'POS']))
    const module = new Module(
      store,
      namedNode(parser.namespace.base),
      parser.output!,
    )
    await module.load()
    return module
  }

  // below include imports; modules includes this
  modules = new Map<Name, Module>()
  rules = new Map<Name, Rule>()
  clauses = new Map<Name, Clause>()

  signature = new QuadSet('SPOG')

  constructor(
    public store: Store,
    public name: NamedNode,
    public facts: Index<TripleSet> = new Index(TripleSet),
  ) {
    store.modules.set(name, this)
  }

  async load(): Promise<void> {
    // represent EDB like this, until we get shapes working
    const anon = variable('_')
    this.signature.add({
      graph: this.name,
      subject: anon,
      predicate: anon,
      object: anon,
    })

    const imports = this.facts.getRoot('SPO').get(this.name).get(fpc('imports'))
    if (imports) {
      const pending: Name[] = []
      for (const i of imports) {
        const module = this.store.modules.get(i)
        if (module) this.modules.set(i, module)
        else pending.push(i)
      }
      for (const m of await Promise.all(pending.map(p => this.store.load(p))))
        this.modules.set(m.name, m)
      for (const m of this.modules.values()) {
        for (const [name, rule] of m.rules) this.rules.set(name, rule)
        m.signature.forEach((q: Quad) => this.signature.add(q))
      }
    }

    const rules = this.facts.getRoot('POS').get(A).get(fpc('Rule'))
    if (rules)
      for (const r of rules) {
        const rule = new Rule(this, r)
        this.rules.set(rule.name, rule)
      }
  }
}
