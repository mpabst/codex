import { CallIndex, map } from './collections/call-index.js'
import { TupleMultiSet } from './collections/tuple-multi-set.js'
import { TupleSet } from './collections/tuple-set.js'
import { VTIndex } from './collections/var-tracking.js'
import { randomString, variable } from './data-factory.js'
import { Bindings, Query } from './query.js'
import { Store } from './store.js'
import { Expression, Head, Pattern, traverse, VarMap } from './syntax.js'
import { BlankNode, NamedNode, Quad, Statement, Term, Triple, Variable } from './term.js'

const stmtMapper = <S extends Statement> (mapper: (t: Term) => Term) => (s: S): S => {
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

export class Clause {
  head = new VTIndex()
  memo: TupleMultiSet<Term> = new Map()
  body: Query

  // var -> value -> bindings
  index: TupleSet<Term | Bindings> = new Map()
  varOrder: Variable[] = []
  // vars[] (by varOrder) -> CT
  calls: CallIndex = new Map()

  constructor(
    public id: NamedNode | BlankNode,
    store: Store,
    head: Head,
    body: Expression<Quad>,
  ) {
    this.body = new Query(store, body)

    const headMap: VarMap = new Map()
    const { varNames: bodyMap } = this.body
    const headVars = new Set<Variable>()
    function mapVar(t: Term): Term {
      if (t.termType !== 'Variable') return t

      let found = bodyMap.get(t as Variable)
      if (found) {
        headVars.add(found)
        return found
      }

      found = headMap.get(t as Variable)
      if (found) return found

      found = variable(randomString())
      headMap.set(t as Variable, found)
      headVars.add(found)
      return found
    }
    traverse(head, {
      pattern: (expr: Pattern<Triple>) => this.head.add(mapStmt(expr.terms, mapVar)),
    })

    this.varOrder = Array.from(headVars)

    store.set(id, this)
  }

  call(caller: Query | null, args: Bindings): Iterable<Bindings> {
    if (caller) {
      const [callers, results] = map(
        this.calls,
        this.varOrder.map(v => args.get(v) ?? v),
      )
      if (callers.size === 0)
        this.body.evaluate((b: Bindings) => results.add(new Map(b)), args)
      callers.add(caller)
      return results
    }

    const out: Bindings[] = []
    this.body.evaluate((b: Bindings) => out.push(new Map(b)), args)
    return out
  }

  // bottom-up
  update() {}
}
