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
import { Operation } from './syntax.js'

export type Bindings = Map<Variable, Term>

export function evaluate(
  store: Store,
  query: Operation,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  function choose(
    root: Operation | undefined,
    node: Node | null = null,
    termIndex: number = 0,
  ) {
    const stack = [root]
    while (true) {
      let term: Term, value: Term | undefined

      function doTwig(): boolean {
        node = node as Twig
        if (value) {
          if (node.has(value)) return true
          else return false
        }
        for (const t of node) {
          bindings.set(term as Variable, t)
          choose(stack.pop())
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
          choose(op, v, termIndex + 1)
        }
        bindings.delete(term as Variable)
        return false
      }

      const op = stack.pop()
      if (!op) {
        emit(new Map(bindings))
        return
      }

      switch (op.type) {
        case 'Conjunction':
          stack.push(op.tail, op.head)
          break
        case 'Line':
          if (termIndex === 0) node = store[op.order]
          for (; termIndex < op.pattern.length; termIndex++) {
            term = op.pattern[termIndex]
            value =
              term.termType === 'Variable'
              ? bindings.get(term as Variable)
              : term
            if (termIndex === op.pattern.length - 1) {
              if (!doTwig()) return
            } else if (!doBranch()) return
          }
          termIndex = 0
          break
      }
    }
  }

  choose(query)
}
