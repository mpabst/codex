export interface Term {
  readonly termType: string
  readonly value: string
}

export interface BlankNode extends Term {
  readonly termType: 'BlankNode'
}

export interface DefaultGraph extends Term {
  readonly termType: 'DefaultGraph'
}

export interface Literal extends Term {
  readonly termType: 'Literal'
  readonly datatype: NamedNode
  readonly language: string
}

export interface NamedNode extends Term {
  readonly termType: 'NamedNode'
}

export interface Variable extends Term {
  readonly termType: 'Variable'
}

// FIXME: special char escaping? ig it doesn't matter for dictionary keys
export function turtle(term: Term): string {
  switch (term.termType) {
    case 'BlankNode':
      return `_:${term.value}`
    case 'DefaultGraph':
      return '__DEFAULT_GRAPH__'
    case 'NamedNode':
      return `<${term.value}>`
    case 'Literal':
      const lit = term as Literal
      if (lit.language !== '') return `"${lit.value}"@${lit.language}`
      else return `"${lit.value}"^^${turtle(lit.datatype)}`
    case 'Variable':
      return `?${term.value}`
    default:
      throw new TypeError('Unsupported termType: ' + term.termType)
  }
}

export const DEFAULT_GRAPH: DefaultGraph = {
  termType: 'DefaultGraph',
  value: '',
}

export type Subject = NamedNode | BlankNode | Variable
export type Predicate = NamedNode | Variable
export type Object = NamedNode | Literal | BlankNode | Variable
export type Graph = NamedNode | BlankNode | Variable | DefaultGraph

export interface Triple {
  readonly subject: Subject
  readonly predicate: Predicate
  readonly object: Object
}

export type FlatTriple = [Subject, Predicate, Object]

export interface Quad {
  readonly subject: Subject
  readonly predicate: Predicate
  readonly object: Object
  readonly graph: Graph
}

export type FlatQuad = [Graph, Subject, Predicate, Object]

export enum TriplePlace {
  Subject,
  Predicate,
  Object,
}

export enum QuadPlace {
  Subject,
  Predicate,
  Object,
  Graph,
}

export type Statement = Quad | Triple

export type Version = number

// will make something more RDFy later
export interface Diff {
  id: NamedNode
  target: NamedNode
  meta: Triple[]
  assertions: Triple[]
  retractions: Triple[]
}
