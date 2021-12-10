// TODO: Dictionary really should be associated with a Store, so we can know
// when to GC dict entries

import { TermDictionary } from './dictionary.js'
import {
  BlankNode,
  DefaultGraph,
  DEFAULT_GRAPH,
  FlatQuad,
  Graph,
  Literal,
  NamedNode,
  Object,
  Predicate,
  Subject,
  Term,
  Variable,
} from './term.js'

const PREFIXES = Object.freeze({
  dc: 'http://purl.org/dc/terms/',
  fp: 'https://fingerpaint.systems/',
  fpc: 'https://fingerpaint.systems/core/',
  fps: 'https://fingerpaint.systems/scratch/',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
})

const DICTIONARY = new TermDictionary()

type Prefixer = (s: string) => NamedNode

type PO = [Predicate, Object] | [Predicate, [Object]]
type S = (subj: Subject, ...terms: PO[]) => Subject
// Object is superset of Subject, so no need to also specify it
type L = (...objs: Object[]) => Subject
type B = (...terms: PO[]) => Subject
type Helpers = { s: S; l: L; b: B; r: S }
type Builder = (fns: Helpers) => void
type Trans = (t: FlatQuad) => FlatQuad[]

export const Prefixers = Object.entries(PREFIXES).reduce(
  (o, [name, head]) => ({ ...o, [name]: prefixer(head) }),
  {} as { [n: string]: Prefixer },
)

const { rdf } = Prefixers

export const A = rdf('type')

export function g(graph: Graph, builder: Builder): FlatQuad[] {
  const out: FlatQuad[] = []

  function basic(trans: Trans) {
    return function (subj: Subject, ...terms: PO[]) {
      for (const [pred, obj] of terms) {
        const push = (o: Object) => out.push(...trans([subj, pred, o, graph]))
        obj instanceof Array ? obj.forEach(push) : push(obj)
      }
      return subj
    }
  }

  const s = basic(t => [t]),
    r = basic(reify)

  const b = (...terms: PO[]) => s(scopedBlankNode(graph), ...terms)

  function l(...objs: Object[]): Subject {
    let head: Object = rdf('nil')
    for (let i = objs.length; i >= 0; i--)
      head = b([A, rdf('List')], [rdf('first'), objs[i]], [rdf('rest'), head])
    return head
  }

  builder({ s, r, b, l })

  return out
}

export function reify(quad: FlatQuad, id: Subject | null = null): FlatQuad[] {
  const graph = quad[3]
  if (!id) id = scopedBlankNode(graph)
  return g(graph, ({ s }) =>
    s(
      id!,
      [A, rdf('Statement')],
      [rdf('subject'), quad[0]],
      [rdf('predicate'), quad[1]],
      [rdf('object'), quad[2]],
    ),
  )
}

export function randomString(length = 8): string {
  const charset = '0123456789abcdefghijklmnopqrztuvwxyz'.split('')
  const out = []
  for (let i = 0; i < length; i++)
    out.push(charset[Math.floor(charset.length * Math.random())])
  return out.join('')
}

export function scopedBlankNode(
  graph: Graph,
  id: string = randomString(),
): BlankNode {
  const prefix = graph.termType === 'NamedNode' ? graph.value + '#' : ''
  return blankNode(`${prefix}_:${id}`)
}

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

function prefixer(prefix: string): Prefixer {
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
