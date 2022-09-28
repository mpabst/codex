import { compile } from './compiler/general.js'
import { Module } from './module.js'
import { Program } from './processor.js'
import { Name, Variable } from './term.js'

export class Query {
  program: Program
  vars: Variable[]
  size: number // size of activation record, ie all callee vars

  constructor(module?: Module, name?: Name, initVars?: Variable[]) {
    if (module && name) {
      const [program, vars, size] = compile(module, name, initVars)
      this.program = program
      this.vars = vars
      this.size = size
    } else {
      this.program = []
      this.vars = []
      this.size = 0
    }
  }
}
