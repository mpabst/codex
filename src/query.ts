import { compile } from './compiler/general.js'
import { Module } from './module.js'
import { Program } from './processor.js'
import { Name, Variable } from './term.js'

export class Query {
  program: Program
  scope: Variable[]
  envSize: number

  constructor(module?: Module, name?: Name, initVars?: Variable[]) {
    if (module && name) {
      const [program, vars, size] = compile(module, name, initVars)
      this.program = program
      this.scope = vars
      this.envSize = size
    } else {
      this.program = []
      this.scope = []
      this.envSize = 0
    }
  }
}
