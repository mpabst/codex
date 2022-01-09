import { blankNode, defaultGraph, literal, Prefixers } from './data-factory.js'
import {
  BlankNode,
  FlatQuad,
  Graph,
  NamedNode,
  Object,
  Predicate,
  Subject,
} from './term.js'

type PO = [Predicate, Object] | [Predicate, Object[]]
type C = (subj: Subject, ...terms: PO[]) => Subject[]
// // Object is superset of Subject, so no need to also specify it
type L = (...objs: Object[]) => Subject

type BaseHelpers = {
  p: (subj: Subject, ...terms: PO[]) => Subject
  l: L
}

type RHelpers = BaseHelpers & {
  ass: C
  ret: C
  g: (graph: Graph, builder: (fns: RHelpers) => void) => Subject[]
}

type Helpers = BaseHelpers & {
  b: () => BlankNode
  r: (builder: (fns: RHelpers) => void) => Subject[]
  and: L
  or: L
}

type Builder = (fns: Helpers) => void

const { fpc, rdf } = Prefixers

export const A = rdf('type')

function context(graph: Graph, quads: FlatQuad[]) {
  function b(): BlankNode {
    return scopedBlankNode(graph)
  }

  function expand(sub: Subject, ...po: PO[]): Subject {
    for (const [pred, obj] of po) {
      const push = (o: Object) => quads.push([sub, pred, o, graph])
      obj instanceof Array ? obj.forEach(push) : push(obj)
    }
    return sub
  }

  function list(type: NamedNode) {
    return function (...oo: Object[]): Subject {
      let head: Object = rdf('nil')
      for (let i = oo.length - 1; i >= 0; i--) {
        head = expand(
          b(),
          [A, type],
          [rdf('first'), oo[i]],
          [rdf('rest'), head],
        )
      }
      return head as Subject
    }
  }

  function reify(quad: FlatQuad, sign: boolean | null = null): Subject {
    const po: PO[] = []
    if (sign !== null) po.push([A, fpc('Change')], [fpc('sign'), literal(sign)])
    else {
      // this elides the difference between a triple and a quad
      // which just happens to refer to the current graph
      if (quad[3] === graph || quad[3] === defaultGraph())
        po.push([A, rdf('Statement')])
      else po.push([A, fpc('Pattern')], [fpc('graph'), quad[3] as Object])
    }
    po.push(
      [rdf('subject'), quad[0]],
      [rdf('predicate'), quad[1]],
      [rdf('object'), quad[2]],
    )
    return context(graph, quads).expand(b(), ...po)
  }

  return { b, expand, reify, list }
}

export function g(
  doc: Graph,
  builder: Builder,
  quads: FlatQuad[] = [],
): FlatQuad[] {
  function r(builder: (helpers: RHelpers) => void): Subject[] {
    const subs: Subject[] = []

    function g(inner: Graph, builder: (fns: RHelpers) => void): Subject[] {
      const subs: Subject[] = []
      builder({ g, ...reificationContext(doc, inner, quads, subs) })
      return subs
    }

    builder({ g, ...reificationContext(doc, doc, quads, subs) })
    return subs
  }

  const { b, expand, list } = context(doc, quads)

  builder({
    r,
    b,
    p: expand,
    l: list(rdf('List')),
    and: list(fpc('And')),
    or: list(fpc('Or')),
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

function reificationContext(
  doc: Graph,
  inner: Graph,
  quads: FlatQuad[],
  subs: Subject[],
) {
  const { reify } = context(doc, quads)

  function reifyPattern(
    sign: boolean | null,
    s: Subject,
    ...po: PO[]
  ): Subject[] {
    const expanded: FlatQuad[] = []
    context(inner, expanded).expand(s, ...po)
    const localSubs: Subject[] = []
    for (const q of expanded) {
      const s = reify(q, sign)
      subs.push(s)
      localSubs.push(s)
    }
    return localSubs
  }

  function l(...oo: Object[]): Subject {
    const list: FlatQuad[] = []
    const head = context(inner, list).list(rdf('List'))(...oo)
    for (const q of list) subs.push(reify(q))
    return head
  }

  function ass(s: Subject, ...po: PO[]): Subject[] {
    return reifyPattern(true, s, ...po)
  }

  function ret(s: Subject, ...po: PO[]): Subject[] {
    return reifyPattern(true, s, ...po)
  }

  function p(s: Subject, ...po: PO[]): Subject {
    reifyPattern(null, s, ...po)
    return s
  }

  return { ass, ret, l, p }
}

export function scopedBlankNode(
  graph: Graph,
  id: string = randomString(),
): BlankNode {
  const prefix = graph.termType === 'NamedNode' ? graph.value + '#_' : ''
  return blankNode(`_:${prefix}${id}`)
}
