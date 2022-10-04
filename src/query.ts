import { Clause } from './clause.js'
import { compile } from './compiler/general.js'
import { Prefixers } from './data-factory.js'
import { Module } from './module.js'
import { operations } from './operations.js'
import { Program } from './processor.js'
import { Name, Variable } from './term.js'

const { fpc } = Prefixers

export abstract class Query {
  program: Program = []
  scope: Variable[] = []
  envSize: number = 0

  constructor(public module: Module | null, public name: Name | null, initVars: Variable[]) {
    if (module && name) {
      const [program, vars, size] = compile(module, name, initVars)
      this.program = program
      this.scope = vars
      this.envSize = size
    }
  }
}

export class Body extends Query {
  constructor(module: Module, public clause: Clause, name?: Name) {
    if (!name)
      [name] = module.facts.getRoot('SPO').get(clause.name).get(fpc('body'))!
    super(module, name!, clause.vars)
    if (clause.memo)
      this.program.push([operations.updateMemo, clause.memo, null])
    this.program.push([operations.return, null, null])
  }
}

export class Matcher extends Query {
  constructor(public program: Program, public scope: Variable[]) {
    super(null, null, [])
  }
}

export class TopLevel extends Query {
  constructor(module: Module, name: Name) {
    super(module, name, [])
  }
}
