import { Branch, Node, Store, Twig } from '../collections/store.js'
import { Term, Variable } from '../term.js'
import { Expression, Pattern } from './syntax.js'

export type Bindings = Map<Variable, Term>

export function evaluate(
  db: Store,
  query: Expression,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  function choose(
    stack: (Expression | null)[] = [],
    dbNode: Node | null = null,
    pIndex: number = 0,
  ) {
    let expr: Expression | null, term: Term, value: Term | undefined

    function doPattern(): boolean {
      expr = expr as Pattern
      if (pIndex === 0) dbNode = db.getIndex(expr.order)
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
      for (const [k, v] of dbNode) {
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
