import { TripleSet } from './collections/data-set.js'
import { Index } from './collections/index.js'
import { VTTripleSet } from './collections/var-tracking.js'
import { namedNode, Prefixers } from './data-factory.js'
import { Module } from './module.js'
import { Body } from './query.js'
import { Rule } from './rule.js'
import { traverse } from './syntax.js'
import { Name, Quad, TRIPLE_PLACES, Variable } from './term.js'
import { getReifiedTriple, VarMap } from './util.js'

const { fpc } = Prefixers

export class Clause {
  vars: Variable[]
  head: VTTripleSet = new VTTripleSet()
  body: Body | null
  memo: Index | null

  constructor(public module: Module, public rule: Rule, public name: Name) {
    module.clauses.set(name, this)
    rule.clauses.set(name, this)

    const po = module.facts.getRoot('SPO').get(name)!
    const [head] = po.get(fpc('head'))!
    this.vars = this.initSignature(head)

    const bodies = po.get(fpc('body'))!
    if (bodies) {
      const [body] = bodies
      // init memo before compiling query, so the former doesn't use
      // vars only found in the body as part of the memo key
      this.memo = new Index(namedNode(name.value + '/memo'), TripleSet)
      this.body = new Body(module, this, body)
    } else {
      this.body = null
      this.memo = null
    }
  }

  protected initSignature(head: Name): Variable[] {
    const vars = new VarMap()

    traverse(this.module.facts, head, {
      doPattern: (pat: Name) => {
        const triple = getReifiedTriple(this.module, pat)
        for (const place of TRIPLE_PLACES)
          if (triple[place] instanceof Variable) vars.map(triple[place])
        this.head.add(triple)
        const quad: Quad = { ...triple, graph: this.name }
        this.module.signature.add(quad)
        this.rule.signature.add(quad)
      },
    })

    return vars.vars
  }
}
