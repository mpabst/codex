import { Memo } from './collections/data-set.js'
import { Prefixers } from './data-factory.js'
import { Module } from './module.js'
import { Body } from './query.js'
import { Rule } from './rule.js'
import { traverse } from './syntax.js'
import { Name, Quad, Variable } from './term.js'
import { getReifiedTriple, VarMap } from './util.js'

const { fpc } = Prefixers

export class Clause {
  vars: Variable[]
  body: Body | null
  memo: Memo | null

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
      this.memo = new Memo(this.vars.length)
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
        const quad: Quad = {
          ...getReifiedTriple(this.module, pat),
          graph: this.name,
        }
        for (const place of ['subject', 'predicate', 'object'])
          if (quad[place] instanceof Variable) vars.map(quad[place])
        this.module.signature.add(quad)
        this.rule.signature.add(quad)
      },
    })

    return vars.vars
  }
}
