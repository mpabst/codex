import { A, randomString } from './builders.js'
import { blankNode, namedNode, PREFIXES, variable } from './data-factory.js'
import {
  Graph,
  NamedNode,
  Object,
  Predicate,
  Subject,
  Term,
  Triple,
  Quad,
} from './term.js'

class Construction {
  constructor(
    public refs: Object[] = [],
    public data: (Triple | Quad)[] = [],
  ) {}
}

export function b(...args: (Term | Construction)[]): Construction {
  return build(blankNode(randomString()), ...args)
}

function build(
  subject: Subject,
  ...rest: (Term | Construction)[]
): Construction {
  if (rest.length % 2 !== 0)
    throw new Error('must have even number of rest args')
  const data: (Triple | Quad)[] = []
  for (let i = 0; i < rest.length; i += 2) {
    const predicate = rest[i] as Predicate,
      objects = rest[i + 1]
    if (objects instanceof Construction) {
      for (const object of objects.refs)
        data.push({ subject, predicate, object })
      for (const d of objects.data) data.push(d)
    } else if (objects instanceof Array)
      for (const object of objects) data.push({ subject, predicate, object })
    else data.push({ subject, predicate, object: objects as Object })
  }
  return new Construction([subject], data)
}

export function g(name: Graph, ...rest: Construction[]): Construction {
  const out: Quad[] = []
  for (const { data } of rest)
    for (const { subject, predicate, object, graph } of data as Quad[])
      out.push({
        subject,
        predicate,
        object,
        graph: graph ?? name,
      })
  return new Construction([], out)
}

const getHandler =
  (dataFactory: (s: string) => Subject, iri: string = '') =>
  (_: any, prop: string): any => {
    return new Proxy(
      Object.assign(() => {}, dataFactory(iri + prop)),
      {
        apply(target, _, args): Construction {
          return build(target, ...args)
        },
      },
    )
  }

const list =
  (type: NamedNode) =>
  (...rest: (Term | Construction)[]): Construction => {
    const data: (Triple | Quad)[] = []
    let head: Subject = rdf.nil
    for (let i = rest.length - 1; i >= 0; i--) {
      const ction = b(A, type, rdf.first, rest[i], rdf.rest, head)
      for (const d of ction.data) data.push(d)
      head = ction.refs[0] as Subject
    }
    return new Construction([head], data)
  }

export function prefixer(iri: string): any {
  return new Proxy({}, { get: getHandler(namedNode, iri) })
}

const reify =
  (sign: boolean | null) =>
  (...ctions: Construction[]): Construction => {
    const refs: Object[] = [],
      data: (Triple | Quad)[] = []
    for (const a of ctions)
      for (const { subject, predicate, object, graph } of a.data as Quad[]) {
        const args = [
          rdf.subject,
          subject,
          rdf.predicate,
          predicate,
          rdf.object,
          object,
        ]
        if (graph) args.push(fpc.graph, graph)
        const type: Term =
          sign !== null ? fpc.Change : graph ? fpc.Pattern : rdf.Statement
        const ction = b(...args, A, type)
        for (const r of ction.refs) refs.push(r)
        for (const d of ction.data) data.push(d)
      }
    return new Construction(refs, data)
  }

export const Prefixers = Object.entries(PREFIXES).reduce(
  (o, [name, head]) => ({ ...o, [name]: prefixer(head) }),
  {} as { [n: string]: any },
)

const { rdf, fpc } = Prefixers

export const v = new Proxy({}, { get: getHandler(variable) })
export const l = list(rdf.List)
export const r = reify(null)
export const ret = reify(false)
export const ass = reify(true)
export const and = list(fpc.And)
export const or = list(fpc.Or)
