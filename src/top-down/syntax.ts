import { Order } from '../collections/store'
import { FlatQuad, Term, Variable } from '../term'

export interface Line {
  type: 'Line'
  pattern: FlatQuad
  order: Order
}

export interface Conjunction {
  type: 'Conjunction'
  head: Operation
  tail: Operation | null
}

interface Negation {
  type: 'Negation'
  op: Operation
  // push a marker onto the stack to abort if we reach it
  // have a flag which has us unwind and continue if no
  // match, instead of abort - possible to just use the flag?
}

export type Operation = Line | Conjunction

export interface Rule {
  // allow disjunctions? could it allow polymorphism?
  head: Conjunction
  body: Operation
}
