import { Branch, DataSet } from './collections/data-set.js'
import { Prefixers } from './data-factory.js'
import { Module } from './module.js'
import {
  A,
  Name,
  NIL,
  Object,
  Predicate,
  Quad,
  Subject,
  Term,
  Triple,
  Variable,
} from './term.js'

const { fpc, rdf } = Prefixers

export class UndefinedError extends Error {
  constructor(module: Module, name: Name) {
    super(`module ${module.name} has no data on subject ${name}`)
  }
}

export class Properties {
  constructor(public data: Map<Term, Set<Term>> = new Map()) {}

  get(pred: Predicate) {
    return this.data.get(pred) ?? new Set()
  }

  // 'get unitary value'
  getUValue(pred: Predicate): Term {
    return [...(this.data.get(pred) ?? [])][0]
  }
}

export class VarMap {
  constructor(public vars: Variable[] = []) {}

  clear(): void {
    this.vars = []
  }

  map(v: Variable): [number, boolean] {
    const i = this.vars.indexOf(v)
    if (i === -1) {
      this.vars.push(v)
      return [this.vars.length - 1, true]
    }
    return [i, false]
  }

  get size(): number {
    return this.vars.length
  }
}

// assumes fpc:Pattern is well-formed
export function getReifiedQuad(spo: Branch, statement: Name): Quad {
  const po = getProps(spo, statement)!
  const [graph] = po.get(fpc('graph'))!
  const [subject] = po.get(rdf('subject'))!
  const [predicate] = po.get(rdf('predicate'))!
  const [object] = po.get(rdf('object'))!
  return { graph, subject, predicate, object }
}

// assumes rdf:Statement is well-formed
export function getReifiedTriple(module: Module, statement: Name): Triple {
  const po = getProps(module, statement)!
  const [subject] = po.get(rdf('subject'))!
  const [predicate] = po.get(rdf('predicate'))!
  const [object] = po.get(rdf('object'))!
  return { subject, predicate, object }
}

export function isA(spo: Branch, head: Subject, type: Object): boolean {
  return getProps(spo, head).get(A)?.has(type) ?? false
}

export function mapList<T>(spo: Branch, head: Subject, cb: (t: Term) => T) {
  const out: T[] = []
  let next = head
  while (next && next !== NIL) {
    const props = getProps(spo, next)
    if (!props) break
    out.push(cb(props.getUValue(rdf('first'))))
    next = props.getUValue(rdf('rest'))
  }
  return out
}

export function getProps(
  data: Module | DataSet | Branch,
  resource: Subject,
): Properties {
  let props: Branch | undefined
  if (!data) props = new Map()
  else if (data instanceof Map) props = data.get(resource) as Branch
  else if (data instanceof Module) props = data.spo.get(resource) as Branch
  else props = (data.root as Branch).get(resource) as Branch
  return new Properties(props as Map<Term, Set<Term>>)
}
