import {
  variable as vari,
  scopedBlankNode,
  Prefixers,
} from '../data-factory.js'
import { DefaultGraph, FlatQuad, NamedNode, Term, Variable } from '../term.js'
import {
  add,
  store as newStore,
  Branch,
  Twig,
  Node,
  Store,
} from '../collections/store.js'
import * as tupleMap from '../collections/tuple-map.js'
import { Call, Head, Pattern, Rule, RuleStore, Expression } from './syntax.js'

const { fps, rdf } = Prefixers

export type Bindings = Map<Variable, Term>

const rule: Rule = {
  head: {
    type: 'Pattern',
    // head patterns are always in the graph declaring the rule?
    terms: [vari('person'), rdf('type'), fps('mortal'), fps('test')],
    order: 'SPOG',
  },
  body: {
    type: 'Pattern',
    // TODO: use default graph here
    terms: [vari('person'), rdf('type'), fps('man'), fps('test')],
    order: 'SPOG',
  },
}

const rules: RuleStore = new Map()
tupleMap.set(rules, [fps('foo'), fps('mortal')], rule)

function assertHead(
  graph: NamedNode | DefaultGraph,
  head: Head,
  bindings: Bindings,
  store: Store,
) {
  const stack: [Head | null] = [head]
  let expr: Head | null

  function doPattern() {
    const out: Term[] = []
    for (const term of (expr as Pattern).terms) {
      if (term.termType === 'Variable') {
        let bound = bindings.get(term)
        if (!bound) {
          bound = scopedBlankNode(graph)
          bindings.set(term, bound)
        }
        out.push(bound)
      } else out.push(term)
    }
    add(store, out as FlatQuad)
  }

  while (true) {
    expr = stack.pop()!
    if (expr === undefined) return
    if (expr === null) continue
    switch (expr.type) {
      case 'Conjunction':
        stack.push(expr.rest, expr.first)
        continue
      case 'Pattern':
        doPattern()
        continue
    }
  }
}

export function evaluate(
  db: Store,
  query: Expression,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
  heap: Store = newStore(),
) {
  function choose(
    stack: (Expression | null)[] = [],
    dbNode: Node | null = null,
    pIndex: number = 0,
  ) {
    let expr: Expression | null, term: Term, value: Term | undefined

    function doCall() {
      expr = expr as Call
      // TODO: pick graph according to expr.order?
      const graph = expr.terms[3] as NamedNode | DefaultGraph
      const args: Bindings = new Map()
      for (const [caller, callee] of expr.varMap)
        args.set(callee, bindings.get(caller)!)
      evaluate(
        db,
        rule.body,
        () => {
          assertHead(graph, rule.head, args, heap)
          for (const [caller, callee] of (expr as Call).varMap)
            bindings.set(caller, args.get(callee)!)
          choose([...stack])
          // TODO: undo bindings? how to tell which ones to unbind?
          // they're all args in varMap not bound before calling
          // evaluate
        },
        args,
        heap,
      )
    }

    function doPattern(): boolean {
      expr = expr as Pattern
      if (pIndex === 0) dbNode = db[expr.order]
      for (; pIndex < expr.terms.length; pIndex++) {
        term = expr.terms[pIndex]
        value =
          term.termType === 'Variable' ? bindings.get(term as Variable) : term
        if (pIndex === expr.terms.length - 1) {
          if (!doTwig()) return false
        } else if (!doBranch()) return false
      }
      pIndex = 0
      return true
    }

    function doTwig(): boolean {
      dbNode = dbNode as Twig
      if (value) return dbNode.has(value)
      for (const t of dbNode) {
        bindings.set(term as Variable, t)
        choose([...stack])
      }
      bindings.delete(term as Variable)
      return false
    }

    function doBranch(): boolean {
      dbNode = dbNode as Branch
      if (value) {
        dbNode = dbNode.get(value)!
        return !!dbNode
      }
      for (const [k, v] of dbNode.entries()) {
        bindings.set(term as Variable, k)
        choose([...stack, expr], v, pIndex + 1)
      }
      bindings.delete(term as Variable)
      return false
    }

    while (true) {
      expr = stack.pop()!

      if (expr === undefined) {
        emit(new Map(bindings))
        return
      }

      if (expr === null) continue

      switch (expr.type) {
        case 'Call':
          doCall()
          return
        case 'Pattern':
          if (!doPattern()) return
          continue
        case 'Conjunction':
          stack.push(expr.rest, expr.first)
          continue
        case 'Disjunction':
          choose([...stack, expr.first])
          choose([...stack, expr.rest])
          return
        default:
          throw new Error(`not implemented: ${expr.type}`)
      }
    }
  }

  choose([query])
}
