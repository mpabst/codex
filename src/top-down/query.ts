import { A, Prefixers, builders, unwrap } from '../builders.js'
import { randomBlankNode } from '../data-factory.js'
import { DefaultGraph, FlatQuad, NamedNode, Term, Variable } from '../term.js'
import {
  Branch,
  Twig,
  Node,
  Store,
} from '../collections/store.js'
import * as tupleMap from '../collections/tuple-map.js'
import {
  // Call,
  Head,
  Pattern,
  Rule,
  RuleStore,
  Expression,
  VarMap,
} from './syntax.js'

const { v } = builders
const { fps } = Prefixers

export type Bindings = Map<Variable, Term>

const rule: Rule = {
  head: {
    type: 'Pattern',
    // head patterns are triples, always in the graph declaring the rule?
    terms: unwrap(v.person, A, fps.mortal, fps.test),
    order: 'SPOG',
  },
  body: {
    type: 'Pattern',
    // TODO: use default graph here
    // what does using a default graph do to the type system?
    // I guess we can examine the subscriptions to know its type
    terms: unwrap(v.person, A, fps.man, fps.test),
    order: 'SPOG',
  },
}

const rules: RuleStore = new Map()
tupleMap.set(rules, unwrap(fps.foo, fps.mortal), rule)

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
      // TODO: let heads express these as blank nodes, instead
      // of vars?
      if (term.termType === 'Variable') {
        let bound = bindings.get(term)
        if (!bound) {
          bound = randomBlankNode()
          bindings.set(term, bound)
        }
        out.push(bound)
      } else out.push(term)
    }
    store.add(out as FlatQuad)
  }

  while (true) {
    expr = stack.pop()!
    if (expr === null) continue
    if (expr === undefined) return
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
  heap: Store = new Store(),
) {
  function choose(
    stack: (Expression | null)[] = [],
    dbNode: Node | null = null,
    pIndex: number = 0,
  ) {
    let expr: Expression | null, term: Term, value: Term | undefined

    // function doCall() {
    //   expr = expr as Call
    //   // TODO: pick graph according to expr.order?
    //   const graph = expr.terms[3] as NamedNode | DefaultGraph
    //   const args: Bindings = new Map()
    //   const unbound: VarMap = new Map()
    //   for (const [caller, callee] of expr.varMap) {
    //     const bound = bindings.get(caller)
    //     if (!bound) unbound.set(caller, callee)
    //     else args.set(callee, bound)
    //   }
    //   evaluate(
    //     db,
    //     rule.body,
    //     () => {
    //       assertHead(graph, rule.head, args, heap)
    //       for (const [caller, callee] of unbound)
    //         bindings.set(caller, args.get(callee)!)
    //       choose([...stack])
    //       // TODO: how to test this unbinding? a callee which has a choice?
    //       for (const [caller] of unbound) bindings.delete(caller)
    //     },
    //     args,
    //     heap,
    //   )
    // }

    function doPattern(): boolean {
      expr = expr as Pattern
      if (pIndex === 0) dbNode = db.getIndex(expr.order)
      for (; pIndex < expr.terms.length; pIndex++) {
        term = expr.terms[pIndex]
        value =
          term.termType === 'Variable' ? bindings.get(term as Variable) : term
        if (pIndex === 0) {
          // graph term
          // if default graph, loop through options
          // local EDB: proceed
          // rule:
          //   local: we have a tuplemap, rule -> in-var -> value
          //     choosing over both avail rules and possible choices of in-var,
          //     the 2nd b/c a pattern might bind to more than one head triple
          //     Given these choices, we check the memo. If it's complete, we
          //     bind, remove that call from the pending list we call at the end,
          //     and continue or fail. Also, we may need to accumulate multiple calls
          //     to a given rule
          //     copy bindings returned by call()
          //   remote: accumulate query fragment somehow
        } else if (pIndex === expr.terms.length - 1) {
          if (!doTwig()) return false
        } else if (!doBranch()) return false
      }
      pIndex = 0
      return true
    }

    function doTwig(): boolean {
      dbNode = dbNode as Twig
      if (value) return dbNode.has(value)
        // else
        // fetch unifications for graph term by
        // evaling query to get other options by examining
        // rule heads - how to unify w variables in rule heads?
        // could just evaluate with emit calling choose
        // iterate through other choices of graph term
        // (could use same logic for owl:sameAs)
        // reflexive unification - bind var to query term?
        //
        // local memos, then extern EDBs, then extern memos
        // if memo is empty, call
        // check all memos before first call? only applicable for
        // non-variable quad, but sure
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

      if (expr === null) continue

      if (expr === undefined) {
        emit(new Map(bindings))
        return
      }

      switch (expr.type) {
        // case 'Call':
        //   doCall()
        //   return
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
