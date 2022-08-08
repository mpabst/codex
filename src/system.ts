import {Store} from './collections/store'
import {Clause} from './clause'
import {BlankNode, NamedNode} from './term'

export enum Status {
  Empty, // better name? to indicate 'not yet computed'
  Partial,
  Complete,
}
