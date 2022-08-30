import { Order } from './collections/data-set.js'
import { Bindings } from './query.js'
import { Statement, Quad, Triple, Variable } from './term.js'

export type VarMap = Bindings<Variable>

export interface Pattern<T extends Statement> {
  type: 'Pattern'
  terms: T
  // calculate order lazily?
  order: Order
}

export interface Conjunction<S extends Statement, E = Expression<S>> {
  type: 'Conjunction'
  first: E
  rest: E | null
}

interface Disjunction {
  type: 'Disjunction'
  first: Expression<Quad>
  rest: Expression<Quad> | null
}

interface Negation {
  type: 'Negation'
  expr: Expression<Quad>
}

interface IfThenElse {
  type: 'IfThenElse'
  condition: Expression<Quad>
  then: Expression<Quad>
  else: Expression<Quad> | null
}

// this isn't quite right, because now Expression<FlatTriple> includes
// body-only (ie quad-only) types. does TS have type parameter polymorphism?
export type Expression<S extends Statement> = Pattern<S> | Conjunction<S> | Disjunction | Negation // | IfThenElse

export type Head = Pattern<Triple> | Conjunction<Triple, Head>

export function traverse<S extends Statement>(
  expr: Expression<S>,
  handlers: { [k: string]: (expr: any) => void },
) {
  const stack: (Expression<S> | null)[] = [expr]
  while (true) {
    const expr = stack.pop()!
    if (expr === null) continue
    if (expr === undefined) return
    switch (expr.type) {
      case 'Conjunction':
        stack.push(expr.rest, expr.first)
        continue
      case 'Pattern':
        handlers.pattern(expr)
        continue
    }
  }
}
