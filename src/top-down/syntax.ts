import { Order } from '../collections/store'
import { FlatQuad } from '../term'

export interface Line {
  type: 'Line'
  pattern: FlatQuad
  order: Order
  rest: Operation | null
}

interface Conjunction<T = Operation> {
  type: 'Conjunction'
  first: T
  rest: Operation | null
}

interface Disjunction {
  type: 'Disjunction'
  first: Operation
  rest: Operation | null
}

interface Negation {
  type: 'Negation'
  first: Operation
  rest: Operation | null
}

export type Operation = Line | Conjunction | Disjunction | Negation // | IfThenElse

export interface Rule {
  // allow disjunctions in heads? could it let us have polymorphism
  // a la multiple rule definitions?
  head: Conjunction<Line>
  body: Operation
}

interface FlatLine {
  type: 'Line'
  pattern: FlatQuad
  order: Order
}

interface FlatConjunction {
  type: 'Conjunction'
  clauses: FlatOperation[]
}

interface FlatDisjunction {
  type: 'Disjunction'
  clauses: FlatOperation[]
}

interface FlatNegation {
  type: 'Negation'
  op: FlatOperation
}

export type FlatOperation = FlatLine | FlatConjunction | FlatDisjunction | FlatNegation

export function parse(flat: FlatOperation, rest: Operation | null = null): Operation {
  switch (flat.type) {
    case 'Line':
      return { ...flat, rest }
    case 'Conjunction':
    case 'Disjunction':
      let first: Operation | null = null
      for (let i = flat.clauses.length - 1; i >= 0; i--)
        first = parse(flat.clauses[i], first)
      return { type: flat.type, first: first!, rest }
    case 'Negation':
      return { type: flat.type, first: parse(flat.op), rest }
  }
}
