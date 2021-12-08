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
import { Line, Operation } from './syntax.js'

export type Bindings = Map<Variable, Term>

export function evaluate(
  store: Store,
  query: Operation,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  function choose(
    op: Operation | null | undefined,
    stack: (Operation | null)[] = [],
    node: Node | null = null,
    termIndex: number = 0,
  ) {
    while (true) {
      if (op === null) {
        op = stack.pop()
        if (op === undefined) {
          emit(new Map(bindings))
          return
        }
        continue
      }

      let term: Term, value: Term | undefined
      op = op as Operation

      switch (op.type) {
        case 'Line':
          if (!doLine()) return
          op = op.rest
          break
        case 'Conjunction':
          stack.push(op.rest)
          op = op.first
          break
        case 'Disjunction':
          let first: Operation | null = op.first
          while (first) {
            choose(first, [...stack, op.rest])
            first = first.rest
          }
          return
        default:
          throw new Error(`not implemented: ${op.type}`)
      }

      function doLine(): boolean {
        op = op as Line
        if (termIndex === 0) node = store[op.order]
        for (; termIndex < op.pattern.length; termIndex++) {
          term = op.pattern[termIndex]
          value =
            term.termType === 'Variable'
            ? bindings.get(term as Variable)
            : term
          if (termIndex === op.pattern.length - 1) {
            if (!doTwig()) return false
          } else if (!doBranch()) return false
        }
        return true
      }

      function doTwig(): boolean {
        op = op as Line
        node = node as Twig
        if (value) {
          if (node.has(value)) return true
          else return false
        }
        for (const t of node) {
          bindings.set(term as Variable, t)
          choose(op.rest, [...stack])
        }
        bindings.delete(term as Variable)
        return false
      }

      function doBranch(): boolean {
        node = node as Branch
        if (value) {
          const found = node.get(value)
          if (!found) return false
          node = found
          return true
        }
        for (const [k, v] of node.entries()) {
          bindings.set(term as Variable, k)
          choose(op, [...stack], v, termIndex + 1)
        }
        bindings.delete(term as Variable)
        return false
      }
    }
  }

  choose(query)
}
