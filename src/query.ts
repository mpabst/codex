import { Clause } from './clause.js'
import { Callee, compile } from './compiler/general.js'
import { Prefixers } from './data-factory.js'
import { Module } from './module.js'
import { operations } from './operations.js'
import { Instruction, Program } from './processor.js'
import { Name, Term, Triple, TRIPLE_PLACES, Variable } from './term.js'
import { printProgram } from './debug.js'
import { getProps } from './helpers.js'

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

  printProgram(): string {
    const out: string[] = []
    printProgram(this.program, l => out.push(l))
    return out.join('\n')
  }
}

export class Body extends Query {
  constructor(module: Module, public clause: Clause, name?: Name) {
    if (!name) name = getProps(module, clause.name).getUValue(fpc('body'))
    super(module, name!, clause.vars)

    // TODO: Support unmemo'd rules
    clause.head.forEach((t: Triple) => {
      for (const place of TRIPLE_PLACES)
        this.program.push(this.memoInstr(t, place))
      this.program.push([operations.addTriple, null, null])
    })

    this.program.push([operations.return, null, null])
  }

  // OPT: instead of a two-stage copy through Processor#triple, have
  // memoize instructions reach directly into memos. Use Proc#dbNode?
  protected memoInstr(t: Triple, place: keyof Triple): Instruction {
    let arg: Term | number = t[place]
    if (arg instanceof Variable)
      return [operations.memoizeVar, this.scope.indexOf(arg), place]
    else return [operations.memoizeConst, arg, place]
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
    this.program.push([operations.emitResult, null, null])
  }
}
