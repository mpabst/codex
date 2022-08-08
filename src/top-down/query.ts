import {Clause} from '../clause.js'
import {Branch, Node, Twig} from '../collections/store.js'
import {Hub, Key} from '../hub.js'
import {Term, Variable} from '../term.js'
import {Expression, Pattern} from './syntax.js'

export type Bindings = Map<Variable, Term>

export function evaluate(
  hub: Hub,
  source: Expression,
  bindings: Bindings = new Map(),
): Bindings[] {
  const results: Bindings[] = []
  // Bindings are callee var -> caller var or constant term,
  // go through and bind caller var values to callee vars at
  // moment of call
  const pendingCalls: Map<Clause, Bindings> = new Map()
  let callList: [Clause, Bindings][]

  function call(cIndex: number): void {
    if (cIndex === callList.length) {
      results.push(new Map(bindings))
      return
    }

    const [clause, params] = callList[cIndex]
    const inArgs: Bindings = new Map()
    const outArgs: [Variable, Variable][] = []

    for (const [callee, caller] of params)
      if (caller.termType === 'Variable') {
        const bound = bindings.get(caller as Variable)
        if (bound) inArgs.set(callee, bound)
        else outArgs.push([callee, caller as Variable])
      } else inArgs.set(callee, caller)

    for (const result of clause.call(inArgs)) {
      for (const [callee, caller] of outArgs)
        bindings.set(callee, result.get(caller)!)
      call(cIndex + 1)
      for (const [callee] of outArgs) bindings.delete(callee)
    }
  }

  function traverse(
    stack: (Expression | null)[] = [],
    dbNode: Node | null = null,
    pIndex: number = 0,
  ) {
    let expr: Expression | null, term: Term, value: Term | undefined

    function doBranch(): boolean {
      dbNode = dbNode as Branch
      if (value) {
        dbNode = dbNode.get(value)!
        return !!dbNode
      }
      for (const [k, v] of dbNode.entries()) {
        bindings.set(term as Variable, k)
        traverse([...stack, expr], v, pIndex + 1)
      }
      bindings.delete(term as Variable)
      return false
    }

    function doPattern(): boolean {
      expr = expr as Pattern

      loop: for (; pIndex < expr.terms.length; pIndex++) {
        term = expr.terms[pIndex]
        value =
          term.termType === 'Variable' ? bindings.get(term as Variable) : term
        switch (pIndex) {
          case 0:
            if (!value) throw new Error('graph terms must be in-vars')
            const module = hub.get(value as Key)
            if (module instanceof Clause) {
              let pending = pendingCalls.get(module)
              if (!pending) {
                pending = module.unify(expr.terms)
              }
            } else dbNode = module!.getIndex(expr.order)
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
        traverse([...stack])
      }
      bindings.delete(term as Variable)
      return false
    }

    while (true) {
      expr = stack.pop()!

      if (expr === null) continue

      if (expr === undefined) {
        callList = Array.from(pendingCalls.entries())
        call(0)
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
          traverse([...stack, expr.first])
          traverse([...stack, expr.rest])
          return
        default:
          throw new Error(`not implemented: ${expr.type}`)
      }
    }
  }

  traverse([source])
  return results
}
