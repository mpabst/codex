// TODO: Dictionary really should be associated with a Store, so we can know
// when to GC dict entries

import { TermDictionary } from './dictionary.js'
import {
  BlankNode,
  DefaultGraph,
  DEFAULT_GRAPH,
  Literal,
  NamedNode,
  Term,
  Variable,
} from './term.js'

export const PREFIXES = Object.freeze({
  dc: 'http://purl.org/dc/terms/',
  fp: 'https://fingerpaint.systems#',
  fpc: 'https://fingerpaint.systems/core#',
  fps: 'https://fingerpaint.systems/scratch#',
  html: 'https://fingerpaint.systems/core/html#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
})

const DICTIONARY = new TermDictionary()

type Prefixer = (s: string) => NamedNode

export const Prefixers = Object.entries(PREFIXES).reduce(
  (o, [name, head]) => ({ ...o, [name]: prefixer(head) }),
  {} as { [n: string]: Prefixer },
)

export function blankNode(value: string): BlankNode {
  return lookup({ termType: 'BlankNode', value }) as BlankNode
}

export function clearDictionary(): void {
  DICTIONARY.clear()
}

export function defaultGraph(): DefaultGraph {
  return lookup(DEFAULT_GRAPH)
}

export function literal(value: any, other?: string | NamedNode): Literal {
  const { xsd } = Prefixers

  if (typeof value === 'number') other = other || xsd('decimal')
  if (typeof value === 'boolean') other = other || xsd('boolean')
  if (value instanceof Date) {
    value = value.toISOString()
    other = other || xsd('dateTime')
  }

  let language: string, datatype: NamedNode
  if (typeof other === 'string') {
    language = other
    datatype = namedNode(
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
    )
  } else if (other) {
    language = ''
    datatype = other
  } else {
    language = ''
    datatype = xsd('string')
  }

  return lookup({ termType: 'Literal', value, datatype, language })
}

export function lookup<T extends Term>(term: T): T {
  return DICTIONARY.lookup(term) as T
}

export function namedNode(value: string): NamedNode {
  return lookup({ termType: 'NamedNode', value })
}

export function prefixer(prefix: string): Prefixer {
  return (suffix: string) => namedNode(prefix + suffix)
}

export function variable(value: string): Variable {
  return lookup({ termType: 'Variable', value })
}

export const DataFactory = {
  namedNode,
  blankNode,
  literal,
  variable,
  defaultGraph,
}
