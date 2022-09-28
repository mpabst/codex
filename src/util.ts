import { Prefixers } from './data-factory.js'
import { Module } from './module.js'
import { Name, Triple, Variable } from './term.js'

const { rdf } = Prefixers

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
  const po = module.facts.getRoot('SPO').get(statement)
  const [subject] = po.get(rdf('subject'))
  const [predicate] = po.get(rdf('predicate'))
  const [object] = po.get(rdf('object'))
  return { subject, predicate, object }
}
