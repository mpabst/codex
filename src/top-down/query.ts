import { Term, Variable } from '../term.js'
import { Branch, Twig, Node, Store } from '../collections/store.js'
import { Pattern, Statement } from './syntax.js'

export type Bindings = Map<Variable, Term>

type Operation = Statement | null

export function evaluate(
  store: Store,
  query: Statement,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  function choose(
    op: Operation | undefined,
    stack: Operation[] = [],
    data: Node | null = null,
    termIndex: number = 0,
  ) {
    stack = [...stack]
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
      op = op as Statement

      switch (op.type) {
        case 'Pattern':
          if (!doLine()) return
          op = null
          continue
        case 'Conjunction':
          stack.push(op.rest)
          op = op.first
          continue
        case 'Disjunction':
          choose(op.first, stack)
          choose(op.rest, stack)
          return
        default:
          throw new Error(`not implemented: ${op.type}`)
      }

      function doLine(): boolean {
        op = op as Pattern
        if (termIndex === 0) data = store[op.order]
        for (; termIndex < op.pattern.length; termIndex++) {
          term = op.pattern[termIndex]
          value =
            term.termType === 'Variable' ? bindings.get(term as Variable) : term
          if (termIndex === op.pattern.length - 1) {
            if (!doTwig()) return false
          } else if (!doBranch()) return false
        }
        return true
      }

      function doTwig(): boolean {
        op = op as Pattern
        data = data as Twig
        if (value) {
          if (data.has(value)) return true
          else return false
        }
        for (const t of data) {
          bindings.set(term as Variable, t)
          choose(null, stack)
        }
        bindings.delete(term as Variable)
        return false
      }

      function doBranch(): boolean {
        data = data as Branch
        if (value) {
          const found = data.get(value)
          if (!found) return false
          data = found
          return true
        }
        for (const [k, v] of data.entries()) {
          bindings.set(term as Variable, k)
          choose(op, stack, v, termIndex + 1)
        }
        bindings.delete(term as Variable)
        return false
      }
    }
  }

  choose(query)
}
