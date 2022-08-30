import { MultiIndex, VTIndex } from './collections/index.js'
import { randomString, variable } from './data-factory.js'
import { Generator } from './generator.js'
import { Bindings, Query } from './query.js'
import { Store } from './store.js'
import { Expression, Head, Pattern, traverse, VarMap } from './syntax.js'
import {
  BlankNode,
  NamedNode,
  Quad,
  Statement,
  Term,
  Triple,
  Variable,
} from './term.js'
import { BindingsSet } from './collections/bindings-set.js'

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

export class Clause {
  signature = new VTIndex()
  generator: Generator
  memo = new MultiIndex()
  body: Query

  calls: BindingsSet

  callerStrata: number[] = []
  listeners: Listener[] = []

  constructor(
    public id: NamedNode | BlankNode,
    store: Store,
    head: Head,
    body: Expression<Quad>,
  ) {
    this.body = new Query(store, body)
    this.generator = new Generator(this.memo, head)
    this.calls = new BindingsSet(this.initSignature(head))
    store.set(id, this)
  }

  protected initSignature(source: Head): Set<Variable> {
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

    traverse(source, {
      pattern: (expr: Pattern<Triple>) =>
        this.signature.add(mapStmt(expr.terms, mapVar)),
    })

    return headVars
  }

  pull(args: Bindings): Iterable<Bindings> {
    const out: Bindings[] = []
    this.body.evaluate((b: Bindings) => {
      out.push(new Map(b))
      this.generator.generate(b)
    }, args)
    return out
  }

  push() {}
}
