import { Clause } from './clause.js'
import { Branch, Index, Node, Twig } from './collections/index.js'
import { Context, Key, Store } from './store.js'
import { Expression, Pattern, traverse } from './syntax.js'
import { Term, Variable } from './term.js'
import { Bindings } from './top-down/query.js'

type Argument = Term | Context | null
type Operation = (m: Query, t: Argument) => void
type Instruction = [Operation, Argument]
type Program = Instruction[]

class ChoicePoint {
  trail: Variable[] = []
  done: boolean = false

  constructor(
    public variable: Variable | null,
    public instructionPtr: number,
    public clause: Clause | null,
    public iterator: Iterator<Term> | null,
  ) {}
}

class Query {
  program: Program
  bindings: Bindings = new Map()
  instructionPtr: number = 0
  clause: Clause | null = null
  args: Bindings = new Map()
  dbNode: Node | null = null
  fail: boolean = false
  // push a dummy choice point so we don't have to branch when
  // pushing variables onto the trail
  stack: ChoicePoint[] = [new ChoicePoint(null, 0, null, null)]
  emit: ((b: Bindings) => void) | null = null
  seenVars = new Set<Variable>()

  constructor(public hub: Store, source: Expression) {
    const [program, variables] = compile(hub, source)
    this.program = program
    for (const v of variables) this.bindings.set(v, v)
  }

  backtrack(): boolean {
    while (true) {
      if (this.stack.length === 1) return false

      const choicePoint = this.stack[this.stack.length - 1]
      if (choicePoint.done) {
        this.stack.pop()
        continue
      }

      // unbind trail vars
      for (const v of choicePoint.trail) this.bindings.set(v, v)
      choicePoint.trail = []

      this.instructionPtr = choicePoint.instructionPtr
      this.clause = choicePoint.clause

      return true
    }
  }

  deref(variable: Variable): Term {
    let found = this.bindings.get(variable)!
    while (found.termType === 'Variable' && found !== found) {
      variable = found as Variable
      found = this.bindings.get(variable)!
    }
    return found
  }

  run(emit: (b: Bindings) => void = console.log): void {
    this.emit = emit
    while (true) {
      const instruction = this.program[this.instructionPtr]
      instruction[0](this, instruction[1])
      if (this.fail && !this.backtrack()) break
    }
    this.emit = null
  }
}

const operations: { [k: string]: Operation } = {
  // make stored argument the Index, not the Term?
  setClause(query: Query, clause: Argument): void {
    query.clause = clause as Clause
    query.dbNode = query.clause.head.getIndex('GSPO')
    query.instructionPtr++
  },

  setIndex(query: Query, index: Argument): void {
    query.dbNode = (index as Index).getIndex('GSPO')
    query.instructionPtr++
  },

  medialConstant(query: Query, term: Argument): void {
    const found = (query.dbNode as Branch).get(term as Term)
    if (!found) {
      query.fail = true
      return
    } else query.dbNode = found
    query.instructionPtr++
  },

  medialNewVariable(query: Query, term: Argument): void {
    let choicePoint: ChoicePoint

    if (query.seenVars.has(term as Variable)) {
      choicePoint = query.stack[query.stack.length - 1]
    } else {
      choicePoint = new ChoicePoint(
        term as Variable,
        query.instructionPtr,
        query.clause,
        (query.dbNode as Branch).keys(),
      )
      query.stack.push(choicePoint)
      query.seenVars.add(term as Variable)
    }

    const result = choicePoint.iterator?.next()!
    if (result.done) {
      choicePoint.done = true
      query.fail = true
      return
    } else query.bindings.set(term as Variable, result.value)

    query.instructionPtr++
  },

  medialOldVariable(query: Query, term: Argument): void {
    operations.medialConstant(query, query.deref(term as Variable))
  },

  finalConstant(query: Query, term: Argument): void {
    if ((query.dbNode as Twig).has(term as Term)) query.instructionPtr++
    else query.fail = true
  },

  finalNewVariable(query: Query, term: Argument): void {},

  finalOldVariable(query: Query, term: Argument): void {
    operations.finalConstant(query, query.deref(term as Variable))
  },

  call(query: Query, term: Argument): void {
    query.clause = null
    query.args = new Map()
  },

  emitResult(query: Query, term: Argument): void {
    query.emit!(new Map(query.bindings))
  },
}

function compile(store: Store, query: Expression): [Program, Set<Variable>] {
  const program: Program = []
  const variables = new Set<Variable>()

  function pattern(expr: Pattern): void {
    // assume GSPO
    const context = store.get(expr.terms[0] as Key)!
    if (context instanceof Clause)
      // program.push([operations.setClause, context])
      throw new Error('todo: calls')
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

    // this is wrong, we only call as we change to a new context
    if (context instanceof Clause) program.push([operations.call, null])
  }

  traverse(query, { pattern })

  program.push([operations.emitResult, null])

  return [program, variables]
}
