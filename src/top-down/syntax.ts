import { Order } from '../collections/store'
import { TupleMap } from '../collections/tuple-map'
import { TupleSet } from '../collections/tuple-set'
import { FlatQuad, Term, Variable } from '../term'

export type VarMap = Map<Variable, Variable>

interface User {
  uses: 
}

// check whether graph term is memo iri to decide whether
// to skip matching; this mode is interpreter state, not
// part of the syntax, because a default graph creates
// a choicepoint, only some of which might be inferrable
export interface Pattern {
  type: 'Pattern'
  terms: FlatQuad
  order: Order
  // tuple order is [memo iri, local var, callee arg]
  // if a memo iri appears in varMap, then we know to
  // make that call once we finish this pattern
  // Q: multiple calls to the same rule via different
  // var mappings? i think this is possible, though
  // we can avoid it by duplicating quads in the syntax
  // tree... still, we could make it map<memo iri -> set<varmap>>
  // and make that set a choicepoint... i don't think i have
  // a collection which can automatically dedup, constructing
  // sets of sets, but i don't really need one
  varMaps: TupleSet<Term>
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
