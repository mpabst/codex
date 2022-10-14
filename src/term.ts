// FIXME: special char escaping in toString()? ig it doesn't matter for
// dictionary keys

import { Namespace } from './parser/namespace.js'
import { Prefixers } from './data-factory.js'
import { TripleSet } from './collections/data-set.js'

export abstract class Term {
  constructor(public readonly value: string) {}

  get termType(): string {
    return this.constructor.name
  }

  abstract toString(namespace?: Namespace): string
}

export class BlankNode extends Term {
  toString(): string {
    return `_:${this.value}`
  }
}

export class DefaultGraph extends Term {
  constructor() {
    super('')
  }

  toString(): string {
    return this.value
  }
}

// push datatype and language up into Term for monomorpho?
export class Literal extends Term {
  constructor(
    value: string,
    public readonly datatype: NamedNode,
    public readonly language: string,
  ) {
    super(value)
  }

  // this is kinda nifty, but maybe move into test dir, since it's
  // dead weight for most users
  toString(namespace?: Namespace): string {
    if (this.language !== '') return `"${this.value}"@${this.language}`
    const { xsd } = Prefixers
    switch (this.datatype) {
      case xsd('string'):
        return `"${this.value}"`
      case xsd('decimal'):
      // fallthrough
      case xsd('boolean'):
        return this.value
      default:
        return `"${this.value}"^^${
          namespace ? namespace.qualify(this.datatype) : this.datatype
        }`
    }
  }
}

export class NamedNode extends Term {
  toString(namespace?: Namespace): string {
    return namespace ? namespace.qualify(this) : `<${this.value}>`
  }
}

export class Variable extends Term {
  toString(): string {
    return `?${this.value}`
  }
}

export const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
export const A = new NamedNode(RDF + 'type')
export const ANON = new Variable('_')
export const DEFAULT_GRAPH = new DefaultGraph()

export type Name = NamedNode | BlankNode
export type Subject = Name | Variable
export type Predicate = NamedNode | Variable
export type Object = Subject | Literal
export type Graph = Subject | DefaultGraph

export interface Tuple {
  [k: string]: Term
}

export interface Triple extends Tuple {
  subject: Subject
  predicate: Predicate
  object: Object
}

export const TRIPLE_PLACES: (keyof Triple)[] = ['subject', 'predicate', 'object']

export interface Quad extends Triple {
  graph: Graph
}

export type FlatTriple = [Subject, Predicate, Object]

export type FlatQuad = [Graph, Subject, Predicate, Object]

// Make values in Statement wrapper objects for Terms,
// so we can add source annotations per-term
export type Statement = Quad | Triple

// will make something more RDFy later
export interface Diff {
  id: Name
  target: Name
  meta: TripleSet
  assertions: TripleSet
  retractions: TripleSet
}
