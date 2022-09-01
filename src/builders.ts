import {
  blankNode,
  namedNode,
  literal,
  randomBlankNode,
  variable,
} from './data-factory.js'
import {
  Graph,
  Object,
  Predicate,
  Subject,
  Triple,
  Quad,
  Term,
  Statement,
  Literal,
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

export const Prefixers = Object.entries(PREFIXES).reduce(
  (o, [name, head]) => ({ ...o, [name]: prefixer(head) }),
  {} as { [n: string]: any },
)

const { rdf, fpc, html } = Prefixers

export const A = rdf.type

type OrAry<T> = T | T[]

type BuilderArgs = OrAry<Building | Object> | Predicate

type Builder = (...args: BuilderArgs[]) => Building

class Building {
  constructor(public refs: Subject[] = [], public data: Statement[] = []) {}

  unwrap(): Statement[] {
    return this.data.map(d => {
      if ('graph' in d)
        return quad(d.graph as Graph, d.subject, d.predicate, d.object)
      else return triple(d.subject, d.predicate, d.object)
    })
  }
}

function blank(...args: BuilderArgs[]): Building {
  return build(randomBlankNode(), ...args)
}

function build(subject: Subject, ...rest: BuilderArgs[]): Building {
  if (rest.length % 2 !== 0)
    throw new Error('must have even number of rest args')

  function push(predicate: Predicate, arg: OrAry<Building | Object>) {
    if (arg instanceof Building) {
      for (const object of arg.refs)
        out.data.push({ subject, predicate, object })
      out.data.push(...arg.data)
    } else if (arg instanceof Array)
      for (const object of arg) push(predicate, object)
    else out.data.push({ subject, predicate, object: arg as Object })
  }

  const out = new Building([subject])
  for (let i = 0; i < rest.length; i += 2)
    push(rest[i] as Predicate, rest[i + 1])
  return out
}

function graph(name: Graph, ...rest: Building[]): Building {
  const out = new Building()
  for (const { data } of rest)
    for (const { subject, predicate, object, graph } of data as Quad[])
      out.data.push({
        subject,
        predicate,
        object,
        graph: graph ?? name,
      })
  return out
}

function builderify(s: Subject) {
  const out: any = Object.assign((...args: BuilderArgs[]) => build(s, ...args), s)
  out.termType = s.termType
  return out
}

function handleGet(
    dataFactory: (s: string) => Subject,
    iri: string,
    extras: { [k: string]: (b: Builder) => any } = {},
  ) {
  return (target: any, prop: string) => {
    if (prop === 'termType') return target.termType
    const builder: { (...a: BuilderArgs[]): Building; [k: string]: any } =
      builderify(dataFactory(iri + prop))
    for (const [k, v] of Object.entries(extras)) builder[k] = v(builder)
    return builder
  }
}

const list =
  (type: Subject) =>
  (...rest: (Building | Object)[]): Building => {
    const objects: Object[] = []
    const data: (Triple | Quad)[] = []

    for (const r of rest)
      if (r instanceof Building) {
        objects.push(...r.refs)
        data.push(...r.data)
      } else objects.push(r)

    let head: Subject = rdf.nil
    for (let i = objects.length - 1; i >= 0; i--) {
      const cell = blank(A, type, rdf.first, objects[i], rdf.rest, head)
      data.push(...cell.data)
      head = cell.refs[0]
    }
    return new Building([head], data)
  }

export function prefixer(iri: string): any {
  return new Proxy(builderify(namedNode(iri)), {
    get: handleGet(namedNode, iri),
  })
}

const reify =
  (sign: boolean | null) =>
  (...ctions: Building[]): Building => {
    const out = new Building()
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
        if (sign !== null) args.push(fpc.sign, literal(sign))
        const type: Object =
          sign !== null ? fpc.Change : graph ? fpc.Pattern : rdf.Statement
        const ction = blank(...args, A, type)
        out.refs.push(...ction.refs)
        out.data.push(...ction.data)
      }
    return out
  }

export function clause(
  type: Object,
  head: Building,
  body: Building,
): Building {
  return blank(
    A,
    type,
    fpc.head,
    builders.and(head),
    fpc.body,
    builders.and(body),
  )
}

export function quad(g: Graph, s: Subject, p: Predicate, o: Object): Quad {
  return {
    graph: unwrap(g),
    subject: unwrap(s),
    predicate: unwrap(p),
    object: unwrap(o),
  }
}

function rule(sub: Builder, ...clauses: Building[]): Building {
  return sub(A, fpc.Rule, fpc.clause, clauses)
}

export function triple(s: Subject, p: Predicate, o: Object): Triple {
  return {
    subject: unwrap(s),
    predicate: unwrap(p),
    object: unwrap(o),
  }
}

const factories: { [k: string]: (s: string) => Term } = {
  BlankNode: blankNode,
  Literal: literal,
  NamedNode: namedNode,
  Variable: variable,
}

export function unwrap<T extends Term>(t: T): T {
  if (t instanceof Literal)
    // || and not ??, since 'no specific language' is represented by the empty
    // string
    return literal(t.value, t.language || t.datatype) as unknown as T
  return factories[t.termType](t.value) as T
}

// variable builder
const v = new Proxy(
  {},
  {
    get: handleGet(variable, '', {
      // html builder
      h:
        (sub: Builder) =>
        (type: Subject, ...children: (Object | Building)[]) =>
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
