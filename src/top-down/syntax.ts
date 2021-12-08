import { Order } from '../collections/store'
import { FlatQuad } from '../term'

export interface Pattern {
  type: 'Pattern'
  pattern: FlatQuad
  order: Order
}

interface Conjunction<T = Statement> {
  type: 'Conjunction'
  first: T
  rest: T | null
}

interface Disjunction {
  type: 'Disjunction'
  first: Statement
  rest: Statement | null
}

interface Negation {
  type: 'Negation'
  first: Statement
  rest: Statement | null
}

export type Statement = Pattern | Conjunction | Disjunction | Negation // | IfThenElse

export interface Rule {
  // allow disjunctions in heads? could it let us have polymorphism
  // a la multiple rule definitions?
  head: Conjunction<Pattern | Conjunction>
  body: Statement
}
