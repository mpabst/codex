import { FlatQuad, Term, Variable } from '../term.js'
import {
  indexOrder,
  reorder,
  Branch,
  Twig,
  Order,
  Node,
  Store,
} from '../collections/store.js'

export type Bindings = Map<Variable, Term>

interface Line {
  readonly pattern: FlatQuad
  readonly order: Order
  readonly next: Line | null
}

export interface Query {
  and: FlatQuad[]
  or: Query[]
}

export function evaluate(
  store: Readonly<Store>,
  query: Readonly<Query>,
  emit: (b: Bindings) => any,
  bindings: Readonly<Bindings> = new Map(),
) {
  const goals = reorderGoals(query.and)

  function choose(
    line: Line | null,
    node: Node | null = null,
    termIndex: number = 0,
  ) {
    function doBranch(): boolean {
      node = node as Branch
      const { term, value } = getValue()

      if (value) {
        const found = node.get(value)
        if (!found) return false
        node = found
        return true
      }

      for (const [k, v] of node!.entries()) {
        bindings.set(term as Variable, k)
        choose(line, v, termIndex + 1)
      }
      bindings.delete(term as Variable)
      return false
    }

    function doTwig(): boolean {
      node = node as Twig
      const { term, value } = getValue()

      if (value) return node.has(value)

      for (const t of node) {
        bindings.set(term as Variable, t)
        choose(line!.next)
      }
      bindings.delete(term as Variable)
      return false
    }

    function getValue(): { term: Term; value: Term | undefined } {
      const term: Term = line!.pattern[termIndex]
      if (term.termType === 'Variable')
        return { term, value: bindings.get(term as Variable) }
      return { term, value: term }
    }

    while (line) {
      if (termIndex === 0) node = store[line.order]
      for (; termIndex < line.pattern.length; termIndex++) {
        switch (node!.constructor) {
          case Map:
            if (!doBranch()) return
            break
          case Set:
            if (!doTwig()) return
            break
        }
      }
      termIndex = 0
      line = line.next
    }

    if (query.or.length || query.calls.length) {
      for (const q of query.or) evaluate(store, q, emit, bindings)
    }
    else emit(new Map(bindings))
  }

  choose(goals)
}

function reorderGoals(goals: FlatQuad[]): Line | null {
  let out: Line | null = null
  for (let i = goals.length - 1; i >= 0; i--) {
    const order = indexOrder(goals[i])
    out = { pattern: reorder(order, goals[i]), order, next: out }
  }
  return out
}
