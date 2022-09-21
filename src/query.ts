import { ask } from './compiler/ask.js'
import { Bindings, Program } from './machine.js'
import { Module } from './module.js'
import { VarMap } from './syntax.js'
import { Node } from './term.js'

export class Query {
  varNames: VarMap // source -> internal names
  program: Program

  constructor(context: Module, expression: Node) {
    const [program, vars] = ask(context, expression)
    this.varNames = vars
    this.program = program
  }

  newScope(args: Bindings | null): Bindings {
    const out = new Map()
    if (args)
      for (const v of this.varNames.values()) out.set(v, args.get(v) ?? v)
    else for (const v of this.varNames.values()) out.set(v, v)
    return out
  }
}
