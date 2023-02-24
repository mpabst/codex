import { Clause } from './clause.js'
import { TripleSet } from './collections/data-set.js'
import { Index } from './collections/index.js'
import { VTQuadSet } from './collections/var-tracking.js'
import { namedNode, Prefixers } from './data-factory.js'
import { Parser } from './parser/parser.js'
import { Rule } from './rule.js'
import { Environment } from './environment.js'
import { A, ANON, Name, NamedNode, Quad } from './term.js'

const { fpc } = Prefixers

export interface Callable {
  clauses: Map<Name, Clause>
  signature: VTQuadSet
}

export class Module implements Callable {
  static async parse(
    store: Environment,
    name: Name,
    source: string,
  ): Promise<Module> {
    const parser = new Parser(name, source)
    parser.parse(new Index(name, TripleSet, ['SPO', 'POS']))
    const module = new Module(store, name, parser.output!)
    await module.load()
    return module
  }

  // all of below include imports, modules includes this
  modules = new Map<Name, Module>()
  rules = new Map<Name, Rule>()
  clauses = new Map<Name, Clause>()

  signature = new VTQuadSet()
  listeners = new VTQuadSet('SPOG')

  constructor(
    public store: Environment,
    public name: NamedNode,
    public facts: Index<TripleSet> = new Index(name, TripleSet),
  ) {
    store.modules.set(name, this)
    this.modules.set(name, this)
  }

  // todo: all these load() methods should be listeners
  async load(): Promise<void> {
    // fixme: represent EDB like this, until we get shapes working.
    // ig i can just declare patterns that go directly into the signature?
    // i can typecheck writes by ensuring every newly asserted triple
    // matches at least one. no cardinality or anything but it's a start
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
      // todo: circular imports? if we want to run all imports to a fixpoint,
      // maybe make signatures just more RDF?
      for (const m of await Promise.all(pending.map(p => this.store.load(p))))
        this.modules.set(m.name, m)
      for (const m of this.modules.values()) {
        for (const [name, clause] of m.clauses) this.clauses.set(name, clause)
        for (const [name, rule] of m.rules) this.rules.set(name, rule)
        m.signature.forEach((q: Quad) => this.signature.add(q))
      }
    }

    // todo: needs some OWL
    for (const klass of ['Rule', 'Writer', 'View']) {
      const rules = this.facts.getRoot('POS').get(A)?.get(fpc(klass))
      if (rules) for (const r of rules) new Rule(this, r)
    }
  }
}
