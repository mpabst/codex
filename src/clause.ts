import { BindingsSet } from './collections/bindings-set.js'
import { Index } from './collections/index.js'
import { Prefixers, randomVariable } from './data-factory.js'
import { Module } from './module.js'
import { Query } from './query.js'
import { Rule } from './rule.js'
import { traverse, VarMap } from './syntax.js'
import { Name, Statement, Term, Variable } from './term.js'

const { fpc, rdf } = Prefixers

const stmtMapper =
  <S extends Statement>(mapper: (t: Term) => Term) =>
  (context: Index, s: Name): S => {
    const po = context.getRoot('SPO').get(s)
    const [subject] = po.get(rdf('subject'))
    const [predicate] = po.get(rdf('predicate'))
    const [object] = po.get(rdf('object'))
    const graphs = po.get(fpc('graph'))
    const out: any = {
      subject: mapper(subject),
      predicate: mapper(predicate),
      object: mapper(object),
    }
    if (graphs) out.graph = mapper([...graphs][0])
    return out
  }

function mapStmt<S extends Statement>(
  context: Index,
  s: Name,
  mapper: (t: Term) => Term,
): S {
  return stmtMapper<S>(mapper)(context, s)
}

export class Clause {
  body: Query
  memo: BindingsSet

  constructor(module: Module, rule: Rule, public name: Name) {
    const po = module.facts.getRoot('SPO').get(name)!
    const [head] = po.get(fpc('head'))!
    const [body] = po.get(fpc('body'))!
    this.body = new Query(module, body)
    this.memo = new BindingsSet(this.initSignature(module, rule, head))
  }

  protected initSignature(
    module: Module,
    rule: Rule,
    head: Name,
  ): Set<Variable> {
    const headMap: VarMap = new Map()
    const { varNames: bodyMap } = this.body
    const headVars = new Set<Variable>()

    function mapVar(t: Term): Term {
      if (!(t instanceof Variable)) return t

      let found = bodyMap.get(t)
      if (found) {
        headVars.add(found)
        return found
      }

      found = headMap.get(t)
      if (found) return found

      found = randomVariable(t)
      headMap.set(t, found)
      headVars.add(found)
      return found
    }

    traverse(module.facts, head, {
      pattern: (node: Name) => {
        const mapped = {
          ...mapStmt(module.facts, node, mapVar),
          graph: this.name,
        }
        module.signature.add(mapped)
        rule.signature.add(mapped)
      },
    })

    return headVars
  }
}
