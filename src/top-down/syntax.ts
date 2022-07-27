import {Order, Store} from '../collections/store'
import {TupleMap} from '../collections/tuple-map'
import {FlatQuad, Term, Variable} from '../term'

// check whether graph term is memo iri to decide whether
// to skip matching; this mode is interpreter state, not
// part of the syntax, because a default graph creates
// a choicepoint, only some of which might be inferrable
export interface Pattern {
  type: 'Pattern'
  terms: FlatQuad
  order: Order
  source: Rule | Store
  varMap: Map<Variable, Term> // callee -> caller
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
  // allow disjunctions in heads? could it let us have polymorphism
  // a la multiple rule definitions?
  head: Head
  body: Expression
}

export type RuleStore = TupleMap<Term, Rule>
