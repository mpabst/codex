import { Clause } from './clause.js'
import { Index, Node } from './collections/index.js'
import { Context, Key, Store } from './store.js'
import { Term, Variable } from './term.js'
import { Bindings } from './top-down/query.js'
import { Expression } from './syntax.js'

type Instruction = [(m: Machine, t: Term) => void, Term]
type Program = Instruction[]

function compile(query: Expression): [Program, Set<Variable>] {
  const stack: (Expression | null)[] = [query]
  const program: Program = []
  const variables = new Set<Variable>()

  while (true) {
    const expr = stack.pop()!
    if (expr === null) continue
    if (expr === undefined) return [program, variables]
    switch (expr.type) {
      case 'Conjunction':
        stack.push(expr.rest, expr.first)
        continue
      case 'Pattern':
        // assume GSPO
        program.push([setContext, expr.terms[0]])
        for (const term of expr.terms.slice(1)) {
          if (term.termType === 'Variable')
            if (variables.has(term)) program.push([oldVariable, term])
            else {
              variables.add(term)
              program.push([newVariable, term])
            }
          else program.push([constant, term])
        }
        continue
    }
  }
}

class Machine {
  dbNode: Node | null = null
  program: Program
  instructionPtr: number = 0
  index: Index | null = null
  fail: boolean = false
  bindings: Bindings = new Map()

  constructor(public hub: Store, query: Expression) {
    const [program, variables] = compile(query)
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

  run(): void {
    let instruction: Instruction
    while (!this.fail) {
      instruction = this.program[this.instructionPtr]
      instruction[0](this, instruction[1])
    }
  }
}

// make stored argument the Index, not the Term
function setContext(machine: Machine, term: Term): void {
  const context = machine.hub.get(term as Key)!

  if (context instanceof Clause) machine.dbNode = context.head.getIndex('GSPO')

  machine.dbNode = machine.context.getIndex('GSPO')
  machine.instructionPtr++
}

function oldVariable(machine: Machine, term: Term): void {}

function newVariable(machine: Machine, term: Term): void {
  machine.bindings.set(term, )
}

function constant(machine: Machine, term: Term): void {}
