import { BindingsSet } from './collections/bindings-set.js'
import { TripleSet } from './collections/data-set.js'
import { VTMap, VTSet } from './collections/var-tracking.js'
import { randomVariable } from './data-factory.js'
import { Module } from './module.js'
import { Query } from './query.js'
import { Store } from './store.js'
import { Head, Pattern, traverse, VarMap } from './syntax.js'
import {
  BlankNode,
  NamedNode,
  Quad,
  Statement,
  Term,
  Triple,
  Variable,
} from './term.js'

const stmtMapper =
  <S extends Statement>(mapper: (t: Term) => Term) =>
  (s: S): S => {
    const out: any = {
      subject: mapper(s.subject),
      predicate: mapper(s.predicate),
      object: mapper(s.object),
    }
    if ('graph' in s) out.graph = mapper(s.graph)
    return out
  }

function mapStmt<S extends Statement>(s: S, mapper: (t: Term) => Term): S {
  return stmtMapper<S>(mapper)(s)
}

interface Listener {
  push(q: Quad): void
}

class Signature extends TripleSet {
  protected Branch = VTMap
  protected Twig = VTSet
}

export class Clause {
  signature = new Signature('SPO')
  body: Query

  calls: BindingsSet

  callerStrata: number[] = []
  listeners: Listener[] = []

  constructor(
    store: Store,
    module: Module,
    public id: NamedNode | BlankNode,
  ) {
    this.body = new Query(store, body)
    this.calls = new BindingsSet(this.initSignature(head))
    store.clauses.set(id, this)
  }

  protected initSignature(source: Head): Set<Variable> {
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

    traverse(source, {
      pattern: (expr: Pattern<Triple>) =>
        this.signature.add(mapStmt(expr.terms, mapVar)),
    })

    return headVars
  }
}
