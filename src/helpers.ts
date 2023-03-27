import { Prefixers } from './data-factory.js'
import { Module } from './module.js'
import {
  A,
  Name,
  NIL,
  Object,
  Predicate,
  Subject,
  Term,
  Triple,
  Variable
} from './term.js'

const { rdf } = Prefixers

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

// assumes rdf:Statement is well-formed
export function getReifiedTriple(module: Module, statement: Name): Triple {
  const po = getProps(module, statement)!
  const [subject] = po.get(rdf('subject'))!
  const [predicate] = po.get(rdf('predicate'))!
  const [object] = po.get(rdf('object'))!
  return { subject, predicate, object }
}

export function isA(module: Module, head: Subject, type: Object): boolean {
  return getProps(module, head).get(A)?.has(type) ?? false
}

export function mapList<T>(module: Module, head: Subject, cb: (t: Term) => T) {
  const out: T[] = []
  let next = head
  while (next && next !== NIL) {
    const props = getProps(module, next)
    if (!props) break
    out.push(cb(props.getUValue(rdf('first'))))
    next = props.getUValue(rdf('rest'))
  }
  return out
}

export function getProps({ subjects }: Module, resource: Subject): Properties {
  return new Properties(subjects.get(resource) as Map<Term, Set<Term>>)
}
