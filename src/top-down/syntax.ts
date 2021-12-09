import { Order } from '../collections/store'
import { TupleMap } from '../collections/tuple-map'
import { FlatQuad, Term, Variable } from '../term'

export type VarMap = Map<Variable, Variable>
export interface Call {
  type: 'Call'
  terms: FlatQuad
  varMap: VarMap
}

export interface Pattern {
  type: 'Pattern'
  terms: FlatQuad
  order: Order
}

interface Conjunction<T = Expression> {
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
  first: Expression
  rest: Expression | null
}

export type Expression = Pattern | Call | Conjunction | Disjunction | Negation // | IfThenElse

export type Head = Pattern | Conjunction<Head>

export interface Rule {
  // allow disjunctions in heads? could it let us have polymorphism
  // a la multiple rule definitions?
  head: Head
  body: Expression
}

export type RuleStore = TupleMap<Term, Rule>
