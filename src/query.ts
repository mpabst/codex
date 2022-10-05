import { Clause } from './clause.js'
import { Callee, compile } from './compiler/general.js'
import { Prefixers } from './data-factory.js'
import { Module } from './module.js'
import { operations } from './operations.js'
import { Instruction, Program } from './processor.js'
import { Name, Term, Triple, TRIPLE_PLACES, Variable } from './term.js'

const { fpc } = Prefixers

export abstract class Query {
  program: Program = []
  scope: Variable[] = []
  callees: Callee[] = []
  envSize: number = 0

  constructor(
    public module: Module | null,
    public name: Name | null,
    initVars: Variable[],
  ) {
    if (module && name) {
      const [program, scope, size] = compile(module, name, initVars)
      this.program = program
      this.scope = scope.vars.vars
      this.callees = scope.callees
      this.envSize = size
    }
  }
}

export class Body extends Query {
  constructor(module: Module, public clause: Clause, name?: Name) {
    if (!name)
      [name] = module.facts.getRoot('SPO').get(clause.name).get(fpc('body'))!
    super(module, name!, clause.vars)
    clause.head.forEach((t: Triple) => {
      for (const place of TRIPLE_PLACES) this.program.push(this.buildDerefTerm(t, place))
      this.program.push([operations.addTriple, null, null])
    })
    this.program.push([operations.return, null, null])
  }

  protected buildDerefTerm(t: Triple, place: keyof Triple): Instruction {
    let arg: Term | number = t[place]
    if (arg instanceof Variable) arg = this.scope.indexOf(arg)
    return [operations.derefTerm, arg, place]
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
