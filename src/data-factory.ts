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

const DICTIONARY = new TermDictionary()

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
  const rdf = prefixer('http://www.w3.org/1999/02/22-rdf-syntax-ns#')
  const xsd = prefixer('http://www.w3.org/2001/XMLSchema#')

  if (typeof value === 'number') other = other || xsd('decimal')
  if (typeof value === 'boolean') other = other || xsd('boolean')
  if (value instanceof Date) {
    value = value.toISOString()
    other = other || xsd('dateTime')
  }

  let language: string, datatype: NamedNode
  if (typeof other === 'string') {
    language = other
    datatype = rdf('langString')
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

function prefixer(prefix: string) {
  return (suffix: string) => namedNode(prefix + suffix)
}

export function randomBlankNode(): BlankNode {
  return blankNode(randomString())
}

// TODO: replace with https://github.com/ai/nanoid
function randomString(length = 8): string {
  const charset = '0123456789abcdefghijklmnopqrztuvwxyz'.split('')
  const out = []
  for (let i = 0; i < length; i++)
    out.push(charset[Math.floor(charset.length * Math.random())])
  return out.join('')
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
