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

export const PREFIXES = {
  dc: 'http://purl.org/dc/terms/',
  fpc: 'https://fingerpaint.systems/core/',
  html: 'https://fingerpaint.systems/core/html/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  test: 'https://example.test/',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
}

const DICTIONARY = new TermDictionary()

export const Prefixers: { [k: string]: (s: string) => NamedNode } = {}
for (const [k, v] of Object.entries(PREFIXES)) Prefixers[k] = prefixer(v)

const { rdf, xsd } = Prefixers

export const A = rdf('type')

export function blankNode(value: string): BlankNode {
  return lookup(new BlankNode(value))
}

export function clearDictionary(): void {
  DICTIONARY.clear()
}

export function defaultGraph(): DefaultGraph {
  return lookup(DEFAULT_GRAPH)
}

export function literal(value: any, other?: string | NamedNode): Literal {
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

  return lookup(new Literal(value, datatype, language))
}

function lookup<T extends Term>(term: T): T {
  return DICTIONARY.lookup(term) as T
}

export function namedNode(value: string): NamedNode {
  return lookup(new NamedNode(value))
}

export function prefixer(prefix: string) {
  return (suffix: string) => namedNode(prefix + suffix)
}

export function randomBlankNode(): BlankNode {
  return blankNode(randomString())
}

export function randomVariable(original: Variable): Variable {
  const out: any = variable(randomString())
  out.original = original
  return out
}

// TODO: replace with https://github.com/ai/nanoid
export function randomString(length = 8): string {
  const charset = '0123456789abcdefghijklmnopqrztuvwxyz'.split('')
  const out = []
  for (let i = 0; i < length; i++)
    out.push(charset[Math.floor(charset.length * Math.random())])
  return out.join('')
}

export function variable(value: string): Variable {
  return lookup(new Variable(value))
}

export const DataFactory = {
  namedNode,
  blankNode,
  literal,
  variable,
  defaultGraph,
}
