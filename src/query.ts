import { Clause } from './clause.js'
import { Prefixers, variable } from './data-factory.js'
import { ScopedBindings, Instruction, Program, Bindings } from './machine.js'
import { Callable, Module } from './module.js'
import { operations } from './operations.js'
import { traverse, VarMap } from './syntax.js'
import { Name, Quad, Term } from './term.js'

const { rdf } = Prefixers

function makeInstruction(caller: Term, callee: Term): Instruction {}

function compile(module: Module, expression: Name): [Program, VarMap] {
  const program: Program = []
  const varMap: VarMap = new Map()
  const lastAppearances = new Map<Clause, number>()

  function pattern(node: Name): void {
    const po = module.facts.getRoot('SPO').get(node)
    const graphs = po.get(rdf('graph'))
    let callable: Callable | undefined
    if (!graphs) callable = module
    else {
      const graph = [...graphs][0]
      // todo: what if a rule and a module are defined at the same name?
      callable = module.imports.get(graph) ?? module.rules.get(graph)
      if (!callable) throw new Error(`graph not found: ${node}`)
    }

    const [subject] = po.get(rdf('subject'))
    const [predicate] = po.get(rdf('predicate'))
    const [object] = po.get(rdf('object'))

    callable.signature.match(
      { graph: variable('_'), subject, predicate, object },
      (q: Quad) => {},
    )
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

  newScope(args: Bindings | null): ScopedBindings {
    const out: ScopedBindings = new Map()
    if (args)
      for (const v of this.varNames.values())
        out.set(v, [null, args.get(v) ?? v])
    else for (const v of this.varNames.values()) out.set(v, [null, v])
    return out
  }
}
