import { Clause } from './clause.js'
import { TripleSet } from './collections/data-set.js'
import { Index } from './collections/index.js'
import { VTQuadSet } from './collections/var-tracking.js'
import { Prefixers } from './data-factory.js'
import { Parser } from './parser/parser.js'
import { Rule } from './rule.js'
import { Store } from './store.js'
import { A, ANON, Name, NamedNode, Quad } from './term.js'

const { fpc } = Prefixers

export interface Callable {
  signature: VTQuadSet
  clauses: Map<Name, Clause>
}

export class Module implements Callable {
  static async parse(
    store: Store,
    name: Name,
    source: string,
  ): Promise<Module> {
    const parser = new Parser(name, source)
    parser.parse(new Index(TripleSet, ['SPO', 'POS']))
    const module = new Module(store, name, parser.output!)
    await module.load()
    return module
  }

  // all of below include imports, modules includes this
  modules = new Map<Name, Module>()
  rules = new Map<Name, Rule>()
  clauses = new Map<Name, Clause>()

  signature = new VTQuadSet('SPOG')

  constructor(
    public store: Store,
    public name: NamedNode,
    public facts: Index<TripleSet> = new Index(TripleSet),
  ) {
    store.modules.set(name, this)
    this.modules.set(name, this)
  }

  // todo: all these load() methods should be listeners
  async load(): Promise<void> {
    // represent EDB like this, until we get shapes working
    this.signature.add({
      graph: this.name,
      subject: ANON,
      predicate: ANON,
      object: ANON,
    })

    const imports = this.facts
      .getRoot('SPO')
      .get(this.name)
      ?.get(fpc('imports'))
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

    for (const klass of ['Rule', 'Writer', 'View']) {
      const rules = this.facts.getRoot('POS').get(A)?.get(fpc(klass))
      if (rules)
        for (const r of rules) {
          const rule = new Rule(this, r)
          this.rules.set(rule.name, rule)
        }
    }
  }
}
