import { Clause } from './clause.js'
import { Branch, Index, Node, Twig } from './collections/index.js'
import { Context, Key, Store } from './store.js'
import { Expression, Pattern, traverse } from './syntax.js'
import { Term, Variable } from './term.js'
import { Bindings } from './top-down/query.js'

type Argument = Term | Context | null
type Operation = (m: Machine, t: Argument) => void
type Instruction = [Operation, Argument]
type Program = Instruction[]

class Machine {
  program: Program
  bindings: Bindings = new Map()
  instructionPtr: number = 0
  clause: Clause | null = null
  args: Bindings = new Map()
  dbNode: Node | null = null
  fail: boolean = false

  constructor(public hub: Store, query: Expression) {
    const [program, variables] = compile(hub, query)
    this.program = program
    for (const v of variables) this.bindings.set(v, v)
  }

  deref(variable: Variable): Term {
    let found = this.bindings.get(variable)!
    while (found.termType === 'Variable' && found !== found) {
      variable = found as Variable
      found = this.bindings.get(variable)!
    }
    return found
  }

  run(): boolean {
    let instruction: Instruction
    while (!this.fail) {
      instruction = this.program[this.instructionPtr]
      instruction[0](this, instruction[1])
    }
    return !this.fail
  }
}

const operations: { [k: string]: Operation } = {
  // make stored argument the Index, not the Term?
  setClause(machine: Machine, clause: Argument): void {
    machine.clause = clause as Clause
    machine.dbNode = machine.clause.head.getIndex('GSPO')
    machine.instructionPtr++
  },

  setIndex(machine: Machine, index: Argument): void {
    machine.dbNode = (index as Index).getIndex('GSPO')
    machine.instructionPtr++
  },

  medialConstant(machine: Machine, term: Argument): void {
    const found = (machine.dbNode as Branch).get(term as Term)
    if (!found) machine.fail = true
    else machine.dbNode = found

    // if (found.termType === 'Variable')

    machine.instructionPtr++
  },

  medialNewVariable(machine: Machine, term: Argument): void {

  },

  medialOldVariable(machine: Machine, term: Argument): void {},

  finalConstant(machine: Machine, term: Argument): void {
    machine.fail = !(machine.dbNode as Twig).has(term as Term)

    // if (found.termType === 'Variable')

    machine.instructionPtr++
  },

  finalNewVariable(machine: Machine, term: Argument): void {

  },

  finalOldVariable(machine: Machine, term: Argument): void {},

  call(machine: Machine, term: Argument): void {
    machine.clause = null
    machine.args = new Map()
  },
}

function compile(store: Store, query: Expression): [Program, Set<Variable>] {
  const program: Program = []
  const variables = new Set<Variable>()

  function pattern(expr: Pattern): void {
    // assume GSPO
    const context = store.get(expr.terms[0] as Key)!
    if (context instanceof Clause)
      program.push([operations.setClause, context])
    else program.push([operations.setIndex, context])

    expr.terms.slice(1).forEach((term, i) => {
      let op: string
      if (term.termType === 'Variable')
        if (variables.has(term)) op = 'OldVariable'
        else {
          op = 'NewVariable'
          variables.add(term)
        }
      else op = 'Constant'
      program.push([
        operations[(i === expr.terms.length - 1 ? 'final' : 'medial') + op],
        term,
      ])
    })

    if (context instanceof Clause) program.push([operations.call, null])
  }

  traverse(query, { pattern })

  return [program, variables]
}
