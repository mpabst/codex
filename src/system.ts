import {Store} from './collections/store'
import {Rule} from './rule'
import {BlankNode, NamedNode} from './term'

export type RootIndex = Map<NamedNode | BlankNode, Rule | Store>

export enum Status {
  Empty, // better name? to indicate 'not yet computed'
  Partial,
  Complete,
}
