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

type Ret = [Subject, FlatQuad[]]
type MRet = [Subject[], FlatQuad[]]
// type G = (id: Graph, builder: Builder) => FlatQuad[]
type PO = [Predicate, Object] | [Predicate, Object[]]
// type P = (subj: Subject, ...terms: PO[]) => Subject
// // Object is superset of Subject, so no need to also specify it
// type L = (...objs: Object[]) => Subject
// type B = () => Subject
// type Helpers = {
//   g: G
//   p: P
//   l: L
//   b: B
//   r: (s: Subject, p: Predicate, o: Object) => Subject
//   rq: (g: Graph, s: Subject, ...t: PO[]) => Subject
//   ass: P
//   ret: P
//   conj: L
//   disj: L
// }
type Builder = (fns: any) => void

export const Prefixers = Object.entries(PREFIXES).reduce(
  (o, [name, head]) => ({ ...o, [name]: prefixer(head) }),
  {} as { [n: string]: Prefixer },
)

const { fpc, rdf } = Prefixers

export const A = rdf('type')

export function graph(
  g: Graph,
  builder: Builder,
  quads: FlatQuad[] = [],
): FlatQuad[] {
  function expand(g: Graph, s: Subject, ...po: PO[]): Ret {
    const qq: FlatQuad[] = []
    for (const [pred, obj] of po) {
      const push = (o: Object) => qq.push([s, pred, o, g])
      obj instanceof Array ? obj.forEach(push) : push(obj)
    }
    return [s, qq]
  }

  function push(qq: FlatQuad[]) {
    for (const q of qq) quads.push(q)
  }

  function b(): BlankNode {
    return scopedBlankNode(g)
  }

  function list(type: NamedNode, ...oo: Object[]): Ret {
    const quads: FlatQuad[] = []
    let head: Object = rdf('nil')
    for (let i = oo.length - 1; i >= 0; i--) {
      const [s, qq] = expand(
        g,
        b(),
        [A, type],
        [rdf('first'), oo[i]],
        [rdf('rest'), head],
      )
      for (const q of qq) quads.push(q)
      head = s
    }
    return [head as Subject, quads]
  }

  function reify(quad: FlatQuad, sign: boolean | null = null): Ret {
    const po: PO[] = []
    if (sign !== null)
      po.push([A, fpc('Mutation')], [fpc('sign'), literal(sign)])
    else {
      // this elides the difference between a triple and a quad
      // which just happens to refer to the current graph
      if (quad[3] === g || quad[3] === defaultGraph())
        po.push([A, rdf('Statement')])
      else po.push([A, fpc('Pattern')], [fpc('graph'), quad[3] as Object])
    }
    po.push(
      [rdf('subject'), quad[0]],
      [rdf('predicate'), quad[1]],
      [rdf('object'), quad[2]],
    )
    return expand(g, b(), ...po)
  }

  function p(s: Subject, ...po: PO[]): Subject {
    const [, qq] = expand(g, s, ...po)
    push(qq)
    return s
  }

  function l(...oo: Object[]): Subject {
    const [s, qq] = list(rdf('List'), ...oo)
    push(qq)
    return s
  }

  function reifyPattern(
    sign: boolean | null,
    g: Graph,
    s: Subject,
    ...po: PO[]
  ): MRet {
    let [, qq] = expand(g, s, ...po)
    const subjects: Subject[] = []
    const quads: FlatQuad[] = []
    for (const q of qq) {
      const [s, rr] = reify(q, sign)
      for (const r of rr) quads.push(r)
      subjects.push(s)
    }
    return [subjects, quads]
  }

  function r(subj: Subject, ...po: PO[]): Subject[] {
    const [ss, qq] = reifyPattern(null, defaultGraph(), subj, ...po)
    push(qq)
    return ss
  }

  function rq(g: Graph, subj: Subject, ...po: PO[]): Subject[] {
    const [ss, qq] = reifyPattern(null, g, subj, ...po)
    push(qq)
    return ss
  }

  function mut(sign: boolean, g: Graph, s: Subject, ...po: PO[]): Subject[] {
    const [ss, qq] = reifyPattern(sign, g, s, ...po)
    push(qq)
    return ss
  }

  function assq(g: Graph, s: Subject, ...po: PO[]): Subject[] {
    return mut(true, g, s, ...po)
  }

  function retq(g: Graph, s: Subject, ...po: PO[]): Subject[] {
    return mut(false, g, s, ...po)
  }

  function ass(s: Subject, ...po: PO[]): Subject[] {
    return mut(true, defaultGraph(), s, ...po)
  }

  function ret(s: Subject, ...po: PO[]): Subject[] {
    return mut(false, defaultGraph(), s, ...po)
  }

  function conj(...oo: Object[]): Subject {
    const [s, qq] = list(fpc('Conjunction'), ...oo)
    push(qq)
    return s
  }

  function disj(...oo: Object[]): Subject {
    const [s, qq] = list(fpc('Disjunction'), ...oo)
    push(qq)
    return s
  }

  builder({
    p,
    r,
    rq,
    b,
    l,
    g,
    ass,
    ret,
    assq,
    retq,
    conj,
    disj,
  })

  return quads
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
