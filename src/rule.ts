import { Clause } from './clause.js'
import { QuadSet } from './collections/data-set.js'
import { Prefixers } from './data-factory.js'
import { Callable, Module } from './module.js'
import { Name } from './term.js'

const { fpc } = Prefixers

export class Rule implements Callable {
  clauses = new Map<Name, Clause>()
  signature = new QuadSet('SPOG')

  constructor(module: Module, public name: Name) {
    const clauses = module.facts.getRoot('SPO').get(name).get(fpc('clause'))
    for (const c of clauses) new Clause(module, this, c)
  }
}