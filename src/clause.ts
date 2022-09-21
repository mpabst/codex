import { BindingsSet } from './collections/bindings-set.js'
import { Index } from './collections/index.js'
import { Prefixers, randomVariable } from './data-factory.js'
import { Module } from './module.js'
import { Query } from './query.js'
import { Store } from './store.js'
import { traverse, VarMap } from './syntax.js'
import {
  Node, Statement,
  Term,
  Variable
} from './term.js'

const { fpc, rdf } = Prefixers

const stmtMapper =
  <S extends Statement>(mapper: (t: Term) => Term) =>
  (context: Index, s: Node): S => {
    const po = context.getRoot('SPO').get(s)
    const [subject] = po.get(rdf('subject'))
    const [predicate] = po.get(rdf('predicate'))
    const [object] = po.get(rdf('object'))
    const graphs = po.get(rdf('graph'))
    const out: any = {
      subject: mapper(subject),
      predicate: mapper(predicate),
      object: mapper(object),
    }
    if ('graph' in s) out.graph = mapper(graphs[0])
    return out
  }

function mapStmt<S extends Statement>(context: Index, s: Node, mapper: (t: Term) => Term): S {
  return stmtMapper<S>(mapper)(context, s)
}

export class Clause {
  body: Query
  memo: BindingsSet

  constructor(
    store: Store,
    context: Module,
    public node: Node
  ) {
    const po = context.facts.getRoot('SPO').get(node)!
    const [head] = po.get(fpc('head'))!
    const [body] = po.get(fpc('body'))!
    this.body = new Query(context, body)
    this.memo = new BindingsSet(this.initSignature(store, context.facts, head))
    store.clauses.set(node, this)
  }

  protected initSignature(store: Store, context: Index, head: Node): Set<Variable> {
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

    traverse(context, head, {
      pattern: (node: Node) =>
        store.signature.add(mapStmt(context, node, mapVar)),
    })

    return headVars
  }
}
