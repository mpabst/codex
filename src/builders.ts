import {
  blankNode,
  namedNode,
  literal,
  randomBlankNode,
  variable,
} from './data-factory.js'
import {Graph, Object, Predicate, Subject, Triple, Quad, Term} from './term.js'

type OrAry<T> = T | T[]

type BuilderArgs = OrAry<Construction | Object> | Predicate

type Builder = (...args: BuilderArgs[]) => Construction

class Construction {
  constructor(
    public refs: Subject[] = [],
    public data: (Triple | Quad)[] = [],
  ) {}

  unwrap(): Term[][] {
    return (this.data as Quad[]).map(({subject, predicate, object, graph}) => {
      const args: Term[] = [subject, predicate, object]
      if (graph) args.push(graph)
      return unwrap(...args)
    })
  }
}

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

export const Prefixers = Object.entries(PREFIXES).reduce(
  (o, [name, head]) => ({...o, [name]: prefixer(head)}),
  {} as {[n: string]: any},
)

const {rdf, fpc, html} = Prefixers

export const A = rdf.type

function blank(...args: BuilderArgs[]): Construction {
  return build(randomBlankNode(), ...args)
}

function build(subject: Subject, ...rest: BuilderArgs[]): Construction {
  if (rest.length % 2 !== 0)
    throw new Error('must have even number of rest args')

  function push(predicate: Predicate, arg: OrAry<Construction | Object>) {
    if (arg instanceof Construction) {
      for (const object of arg.refs) out.data.push({subject, predicate, object})
      out.data.push(...arg.data)
    } else if (arg instanceof Array)
      for (const object of arg) push(predicate, object)
    else out.data.push({subject, predicate, object: arg as Object})
  }

  const out = new Construction([subject])
  for (let i = 0; i < rest.length; i += 2)
    push(rest[i] as Predicate, rest[i + 1])
  return out
}

function graph(name: Graph, ...rest: Construction[]): Construction {
  const out = new Construction()
  for (const {data} of rest)
    for (const {subject, predicate, object, graph} of data as Quad[])
      out.data.push({
        subject,
        predicate,
        object,
        graph: graph ?? name,
      })
  return out
}

function builderify(sub: Subject) {
  return Object.assign((...args: BuilderArgs[]) => build(sub, ...args), sub)
}

function getHandler(
  dataFactory: (s: string) => Subject,
  iri: string,
  extras: {[k: string]: (b: Builder) => any} = {},
) {
  return (_: any, prop: string) => {
    const builder: {(...a: BuilderArgs[]): Construction; [k: string]: any} =
      builderify(dataFactory(iri + prop))
    for (const [k, v] of Object.entries(extras)) builder[k] = v(builder)
    return builder
  }
}

const list =
  (type: Subject) =>
  (...rest: (Construction | Object)[]): Construction => {
    const objects: Object[] = []
    const data: (Triple | Quad)[] = []

    for (const r of rest)
      if (r instanceof Construction) {
        objects.push(...r.refs)
        data.push(...r.data)
      } else objects.push(r)

    let head: Subject = rdf.nil
    for (let i = objects.length - 1; i >= 0; i--) {
      const cell = blank(A, type, rdf.first, objects[i], rdf.rest, head)
      data.push(...cell.data)
      head = cell.refs[0]
    }
    return new Construction([head], data)
  }

export function prefixer(iri: string): any {
  return new Proxy(builderify(namedNode(iri)), {
    get: getHandler(namedNode, iri),
  })
}

const reify =
  (sign: boolean | null) =>
  (...ctions: Construction[]): Construction => {
    const out = new Construction()
    for (const a of ctions)
      for (const {subject, predicate, object, graph} of a.data as Quad[]) {
        const args = [
          rdf.subject,
          subject,
          rdf.predicate,
          predicate,
          rdf.object,
          object,
        ]
        if (graph) args.push(fpc.graph, graph)
        if (sign !== null) args.push(fpc.sign, literal(sign))
        const type: Object =
          sign !== null ? fpc.Change : graph ? fpc.Pattern : rdf.Statement
        const ction = blank(...args, A, type)
        out.refs.push(...ction.refs)
        out.data.push(...ction.data)
      }
    return out
  }

function clause(
  type: Object,
  head: Construction,
  body: Construction,
): Construction {
  return blank(
    A,
    type,
    fpc.head,
    builders.and(head),
    fpc.body,
    builders.and(body),
  )
}

function rule(sub: Builder, ...clauses: Construction[]): Construction {
  return sub(A, fpc.Rule, fpc.clause, clauses)
}

const factories: {[k: string]: (s: string) => Term} = {
  BlankNode: blankNode,
  Literal: literal,
  NamedNode: namedNode,
  Variable: variable,
}

export function unwrap<T extends Term[] | Term[][]>(...args: T): T {
  const out = []
  for (const a of args)
    if (a instanceof Array) out.push(unwrap(...a))
    else {
      const t = a as Term
      out.push(factories[t.termType](t.value))
    }
  return out as T
}

// variable builder
const v = new Proxy(
  {},
  {
    get: getHandler(variable, '', {
      // html builder
      h:
        (sub: Builder) =>
        (type: Subject, ...children: (Object | Construction)[]) =>
          sub(A, type, html.children, list(rdf.List)(...children)),
    }),
  },
)

export const builders = {
  g: graph,
  b: blank,
  v,
  l: list(rdf.List),
  r: reify(null),
  rem: reify(false),
  add: reify(true),
  and: list(fpc.And),
  or: list(fpc.Or),
  clause,
  rule,
}
