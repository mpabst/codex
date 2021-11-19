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
  store: Store,
  query: Query,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  const goals = reorderGoals(query.and)

  function choose(
    line: Line | null,
    node: Node | null = null,
    termIndex: number = 0,
  ) {
    while (line) {
      if (termIndex === 0) node = store[line.order]
      for (; termIndex < line.pattern.length; termIndex++) {
        const term: Term = line!.pattern[termIndex]
        const value =
          term.termType === 'Variable' ? bindings.get(term as Variable) : term

        switch (node!.constructor) {
          case Map:
            node = node as Branch

            if (value) {
              const found = node.get(value)
              if (!found) return
              node = found
              break
            }

            for (const [k, v] of node!.entries()) {
              bindings.set(term as Variable, k)
              choose(line, v, termIndex + 1)
            }
            bindings.delete(term as Variable)
            return

          case Set:
            node = node as Twig

            if (value) {
              if (node.has(value)) break
              else return
            }

            for (const t of node) {
              bindings.set(term as Variable, t)
              choose(line!.next)
            }
            bindings.delete(term as Variable)
            return
        }
      }
      termIndex = 0
      line = line.next
    }

    if (query.or.length) {
      for (const q of query.or) evaluate(store, q, emit, bindings)
    } else emit(new Map(bindings))
  }

  choose(goals)
}

function reorderGoals(goals: FlatQuad[]): Line | null {
  let out: Line | null = null
  for (let i = goals.length - 1; i >= 0; i--) {
    const order = 'SPOG' // indexOrder(goals[i])
    out = { pattern: reorder(order, goals[i]), order, next: out }
  }
  return out
}
