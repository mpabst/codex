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

type G = (id: Graph, builder: Builder) => FlatQuad[]
type PO = [Predicate, Object] | [Predicate, Object[]]
type P = (subj: Subject, ...terms: PO[]) => Subject
// Object is superset of Subject, so no need to also specify it
type L = (...objs: Object[]) => Subject
type B = () => Subject
type Helpers = {
  g: G
  p: P
  l: L
  b: B
  r: P
  rq: (g: Graph, s: Subject, ...t: PO[]) => Subject
  ass: P
  ret: P
  conj: L
  disj: L
}
type Builder = (fns: Helpers) => void
type Handler = (q: FlatQuad) => void

export const Prefixers = Object.entries(PREFIXES).reduce(
  (o, [name, head]) => ({ ...o, [name]: prefixer(head) }),
  {} as { [n: string]: Prefixer },
)

const { fpc, rdf } = Prefixers

export const A = rdf('type')

function grapher(data: FlatQuad[] = []) {
  return function (graph: Graph, builder: Builder): FlatQuad[] {
    function pattern(g: Graph = graph, handle: Handler = q => data.push(q)) {
      return function (subj: Subject, ...terms: PO[]): FlatQuad[] {
        for (const [pred, obj] of terms) {
          const expand = (o: Object) => handle([subj, pred, o, g])
          obj instanceof Array ? obj.forEach(expand) : expand(obj)
        }
        return subj
      }
    }

    const p = pattern(),
      b = () => scopedBlankNode(graph),
      g = grapher(data)

    function list(type: Subject = rdf('List')) {
      return function (...objs: Object[]): Subject {
        let head: Object = rdf('nil')
        for (let i = objs.length; i >= 0; i--)
          head = p(b(), [A, type], [rdf('first'), objs[i]], [rdf('rest'), head])
        return head
      }
    }

    function reify(sign: boolean | null = null) {
      return function (quad: FlatQuad, id: Subject | null = null): Subject {
        const type =
          sign === null
            // this elides the difference between a triple and a quad
            // which just happens to refer to the current graph
            ? quad[3] === graph || quad[3] === defaultGraph()
              ? rdf('Statement')
              : fpc('Pattern')
            : fpc('Mutation')

        if (!id) id = scopedBlankNode(graph)
        const args: PO[] = [
          [A, type],
          [rdf('subject'), quad[0]],
          [rdf('predicate'), quad[1]],
          [rdf('object'), quad[2]],
        ]
        if (type !== rdf('Statement'))
          args.push([fpc('graph'), quad[3] as Object])
        if (type === fpc('Mutation'))
          args.push([fpc('sign'), literal(sign)])
        return p(id!, ...args)
      }
    }

    builder({
      p,
      r: pattern(graph, reify()),
      b,
      l: list(),
      g,
      rq: (g: Graph, s: Subject, ...t: PO[]) => pattern(g, reify())(s, ...t),
      ass: pattern(graph, reify(true)),
      ret: pattern(graph, reify(false)),
      conj: list(fpc('Conjunction')),
      disj: list(fpc('Disjunction')),
    })

    return data
  }
}

export const graph = grapher()

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
