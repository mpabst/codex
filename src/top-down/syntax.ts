import { Order } from '../collections/store'
import { FlatQuad, Term, Variable } from '../term'

export interface Line {
  type: 'Line'
  pattern: FlatQuad
  order: Order
}

export interface Conjunction {
  type: 'Conjunction'
  clauses: Operation[]
}

export interface Disjunction {
  type: 'Disjunction'
  clauses: Operation[]
}

interface Negation {
  type: 'Negation'
  op: Operation
  // push a marker onto the stack to abort if we reach it
  // have a flag which has us unwind and continue if no
  // match, instead of abort - possible to just use the flag?
}

export type Operation = Conjunction | Disjunction | Negation // | IfThenElse

export interface Rule {
  // allow disjunctions? could it allow polymorphism?
  head: Conjunction
  body: Operation
}

export function buildQuery(
  op: Operation | null,
  parent: Operation | null = null,
): Operation | null {
  if (!op) return null
  switch (op.type) {
    case 'Conjunction':
      return { ...op, left: buildQuery(op.left, op)!, next: parent }
    case 'Line':
      return { ...op, next: parent }
  }
}

// export function getNext(op: Operation): Operation | null {
//   while (true) {
//     let parent: Operation | null = op.parent
//     if (!parent) return null
//     switch (parent.type) {
//       case 'Conjunction':
//         switch (op.key) {
//           case 'head':
//             return parent.tail
//           case 'tail':
//             op = parent
//             continue
//         }
//       default:
//         throw new Error('how did i get here?')
//     }
//   }
// }
