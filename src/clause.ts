import { BindingsSet } from './collections/bindings-set.js'
import { Prefixers } from './data-factory.js'
import { Module } from './module.js'
import { operations } from './operations.js'
import { Query } from './query.js'
import { Rule } from './rule.js'
import { traverse } from './syntax.js'
import { Name, Quad, Variable } from './term.js'
import { VarMap } from './var-map.js'

const { fpc, rdf } = Prefixers

export class Clause {
  vars: Variable[]
  body: Query | null
  memo: BindingsSet | null

  constructor(module: Module, rule: Rule, public name: Name) {
    module.clauses.set(name, this)
    rule.clauses.set(name, this)
    const po = module.facts.getRoot('SPO').get(name)!
    const [head] = po.get(fpc('head'))!
    const bodies = po.get(fpc('body'))!
    if (bodies) {
      const [body] = bodies
      this.body = new Query(module, body)
      this.body.program.push([operations.return, null, null])
      this.vars = this.initSignature(module, rule, head)
      this.memo = new BindingsSet(this.vars)
    } else {
      this.body = null
      this.memo = null
      this.vars = this.initSignature(module, rule, head)
    }
  }

  protected initSignature(module: Module, rule: Rule, head: Name): Variable[] {
    const vars = new VarMap([...(this.body?.vars ?? [])])
    traverse(module.facts, head, {
      pattern: (node: Name) => {
        const po = module.facts.getRoot('SPO').get(node)
        const [subject] = po.get(rdf('subject'))
        const [predicate] = po.get(rdf('predicate'))
        const [object] = po.get(rdf('object'))
        const quad: Quad = {
          subject,
          predicate,
          object,
          graph: this.name,
        }
        for (const place of ['subject', 'predicate', 'object'])
          if (quad[place] instanceof Variable) vars.map(quad[place])
        module.signature.add(quad)
        rule.signature.add(quad)
      },
    })
    return vars.vars
  }
}
