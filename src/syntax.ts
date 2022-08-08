import { Order } from './collections/index.js'
import { FlatQuad, Term, Variable } from './term.js'

export type VarMap = Map<Variable, Variable>

export interface Pattern {
  type: 'Pattern'
  terms: FlatQuad
  // calculate order lazily?
  order: Order
}

export interface Conjunction<T = Expression> {
  type: 'Conjunction'
  first: T
  rest: T | null
}

interface Disjunction {
  type: 'Disjunction'
  first: Expression
  rest: Expression | null
}

interface Negation {
  type: 'Negation'
  expr: Expression
}

interface IfThenElse {
  type: 'IfThenElse'
  condition: Expression
  then: Expression
  else: Expression | null
}

export type Expression = Pattern | Conjunction | Disjunction | Negation // | IfThenElse

export type Head = Pattern | Conjunction<Head>

export interface Rule {
  head: Head
  body: Expression
}

export function traverse(
  expr: Expression,
  handlers: { [k: string]: (expr: any) => void },
) {
  const stack: (Expression | null)[] = [expr]
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
