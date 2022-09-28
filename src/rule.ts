import { Clause } from './clause.js'
import { VTQuadSet } from './collections/var-tracking.js'
import { Prefixers } from './data-factory.js'
import { Callable, Module } from './module.js'
import { Name } from './term.js'

const { fpc } = Prefixers

export class Rule implements Callable {
  clauses = new Map<Name, Clause>()
  signature = new VTQuadSet()

  constructor(module: Module, public name: Name) {
    module.rules.set(name, this)
    const clauses = module.facts.getRoot('SPO').get(name).get(fpc('clause'))
    for (const c of clauses) new Clause(module, this, c)
  }
}
