import { Term, Variable } from '../term.js'
import { Branch, Twig, Node, Store } from '../collections/store.js'
import { Statement } from './syntax.js'

export type Bindings = Map<Variable, Term>

type Operation = Statement | null

export function evaluate(
  store: Store,
  query: Statement,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  function choose(
    stack: Operation[] = [],
    data: Node | null = null,
    termIndex: number = 0,
  ) {
    let op: Operation, term: Term, value: Term | undefined

    while (true) {
      op = stack.pop()!

      if (op === undefined) {
        emit(new Map(bindings))
        return
      }

      if (op === null) continue

      switch (op.type) {
        case 'Pattern':
          if (termIndex === 0) data = store[op.order]
          for (; termIndex < op.pattern.length; termIndex++) {
            term = op.pattern[termIndex]
            value = term.termType === 'Variable'
              ? bindings.get(term as Variable)
              : term

            if (termIndex === op.pattern.length - 1) {
              data = data as Twig
              if (value) {
                if (data.has(value)) continue
                else return
              }
              for (const t of data) {
                bindings.set(term as Variable, t)
                choose([...stack])
              }
              bindings.delete(term as Variable)
              return

            } else {
              data = data as Branch
              if (value) {
                data = data.get(value)!
                if (!data) return
                continue
              }
              for (const [k, v] of data.entries()) {
                bindings.set(term as Variable, k)
                choose([...stack, op], v, termIndex + 1)
              }
              bindings.delete(term as Variable)
              return
            }
          }

          termIndex = 0
          continue

        case 'Conjunction':
          stack.push(op.rest, op.first)
          continue
        case 'Disjunction':
          choose([...stack, op.first])
          choose([...stack, op.rest])
          return
        default:
          throw new Error(`not implemented: ${op.type}`)
      }
    }
  }

  choose([query])
}
