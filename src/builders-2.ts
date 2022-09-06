import { literal, namedNode } from './data-factory'
import { DEFAULT_GRAPH, Graph, NamedNode, Object, Predicate, Quad, Term } from './term'

export const TOKENS = {
  graph: 'graph',
  rule: 'rule',
  list: 'list',
  ass: 'ass',
  ret: 'ret',
  reify: 'reify',
  and: 'and',
  or: 'or',
}

// export const tokens = 'graph rule list ass ret reify and or'
//   .split(' ')
//   .reduce((m, n) => ({ ...m, [n]: n }), {})

type Source = (Term | string | Source)[]

function build(
  source: Source,
  context: Partial<Quad> = { graph: DEFAULT_GRAPH },
  acc: Quad[] = [],
): Quad[] {
  if (context.predicate) {
    if (source[0] as string in TOKENS) {
      switch (source[0]) {
        case TOKENS.list:
        case TOKENS.and:
        case TOKENS.or:
          list(source, context, acc)
          break
        case TOKENS.reify:
          reify(source.slice(1), context, acc)
          break
        default:
          throw new TypeError(`unrecognized token: ${source[0]}`)
      }
    } else if (source[0] instanceof Term)
      for (const o of source)
        acc.push({ ...context, object: o as Object } as Quad)
    else 
  } else if (context.subject) {
    if (source.length % 2 === 0)
      throw new Error('array needs an odd number of elements')
    for (let i = 1; i < source.length; i += 2) {
      if (!(source[i] instanceof Term))
        throw new Error('predicate must be a Term')
      context = { ...context, predicate: source[i] as Predicate }
      if (source[i + 1] instanceof Array)
        build(source[i + 1] as Array<Term>, context, acc)
      else acc.push({ ...context, object: source[i + 1] as Object } as Quad)
    }

  } else if (source[0] instanceof Term) {
    build(source.slice(1), { ...context, subject: source[0] }, acc)
  } else
    switch (source[0]) {
      case TOKENS.graph:
        if (!(source[1] instanceof Term))
          throw new Error('graph arg must be a Term')
        build(source.slice(2), { graph: source[1] as Graph }, acc)
        break
      case TOKENS.rule:
      case TOKENS.ass:
      case TOKENS.ret:
      case TOKENS.reify:
      default:
        throw new TypeError(`unrecognized token: ${source[0]}`)
    }

  return acc
}

function list(source: Source, context: Partial<Quad>, acc: Quad[]): void {

}

function object(o: any): Term {
  if (o instanceof Term) return o
  return literal(o)
}

function prefixer(baseIri: string) {
  return new Proxy(() => namedNode(baseIri), {
    get: (_: any, prop: string): NamedNode => namedNode(baseIri + prop)
  })
}

function reify(source: Source, context: Partial<Quad>, outer: Quad[]): void {
  const inner: Quad[] = []
  if (context.predicate) {

  } else if (context.subject) {
    throw new Error('reification not allowed in predicate position')
  } else switch (source[0]) {

  }
  outer.push(...inner.flatMap(reifyQuad))
}

const reifyQuad = (context: Partial<Quad>, acc: Quad[]) => (q: Quad): void => {}
