import {Branch, Node, Twig} from '../collections/store.js'
import {Rule} from '../rule.js'
import {RootIndex} from '../system.js'
import {Term, Variable} from '../term.js'
import {Expression, Pattern} from './syntax.js'

export type Bindings = Map<Variable, Term>

export function query(
  rootIndex: RootIndex,
  query: Expression,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  function choose(
    stack: (Expression | null)[] = [],
    dbNode: Node | null = null,
    pIndex: number = 0,
  ) {
    const pendingCalls: Rule[] = []
    let expr: Expression | null, term: Term, value: Term | undefined

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

    function doCalls(cIndex: number = 0): void {
      if (cIndex === pendingCalls.length) {
        emit(new Map(bindings))
        return
      }
      // make first call, pass in mapped bindings - in its callback,
      // make second call, mapping bindings again. undo bindings?
      pendingCalls[0].call(mapBindings(bindings, ))
    }

    function doPattern(): boolean {
      expr = expr as Pattern

      loop: for (; pIndex < expr.terms.length; pIndex++) {
        term = expr.terms[pIndex]
        value =
          term.termType === 'Variable' ? bindings.get(term as Variable) : term
        switch (pIndex) {
          case 0:
            if (expr.source instanceof Rule) {
              pendingCalls.push(expr.source)
              break loop
            }
            break
          case expr.terms.length - 1:
            if (!doTwig()) return false
            break
          default:
            if (!doBranch()) return false
        }
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

    while (true) {
      expr = stack.pop()!

      if (expr === null) continue

      if (expr === undefined) {
        doCalls()
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
