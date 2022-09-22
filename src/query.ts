import { Prefixers } from './data-factory.js'
import { Bindings, Program } from './machine.js'
import { Callable, Module } from './module.js'
import { traverse, VarMap } from './syntax.js'
import { DEFAULT_GRAPH, Name } from './term.js'

const { rdf } = Prefixers

function compile(module: Module, expression: Name): [Program, VarMap] {
  const program: Program = []
  const varMap: VarMap = new Map()

  function pattern(node: Name): void {
    const po = module.facts.getRoot('SPO').get(node)
    const graphs = po.get(rdf('graph'))
    let callable: Callable
    if (!graphs) callable = module
    else if ()

    const graph = (graphs ? [...graphs][0] : DEFAULT_GRAPH)
    
  }

  traverse(module.facts, expression, { pattern })

  return [program, varMap]
}

export class Query {
  varNames: VarMap // source -> internal names
  program: Program

  constructor(module: Module, name: Name) {
    const [program, vars] = compile(module, name)
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
