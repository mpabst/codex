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
  constructor(
    public instructionPtr: number,
    public clause: Clause | null,
    public iterator: Iterator<Term> | null,
  ) {}
}

class Query {
  program: Program
  instructionPtr: number = 0

  dbNode: Node | null = null
  fail: boolean = false

  stack: ChoicePoint[] = []
  seenVars = new Set<Variable>()

  clause: Clause | null = null
  args: Bindings = new Map()

  emit: ((b: Bindings) => void) | null = null

  constructor(
    public hub: Store,
    source: Expression,
    public bindings: Bindings = new Map(),
  ) {
    const [program, variables] = compile(hub, source)
    this.program = program
    for (const v of variables) this.bindings.set(v, v)
  }

  backtrack(): boolean {
    const length = this.stack.length
    if (length === 0) return false
    const choicePoint = this.stack[length - 1]
    this.instructionPtr = choicePoint.instructionPtr
    this.clause = choicePoint.clause
    return true
  }

  deref(variable: Variable): Term {
    let found = this.bindings.get(variable)!
    while (found.termType === 'Variable' && found !== variable) {
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
    query.dbNode = (clause as Clause).head.getIndex('GSPO')
    query.instructionPtr++
  },

  setIndex(query: Query, index: Argument): void {
    query.dbNode = (index as Index).getIndex('GSPO')
    query.instructionPtr++
  },

  newVariable(query: Query, term: Argument) {
    let choicePoint: ChoicePoint

    if (query.seenVars.has(term as Variable)) {
      choicePoint = query.stack[query.stack.length - 1]
    } else {
      choicePoint = new ChoicePoint(
        query.instructionPtr,
        query.clause,
        query.dbNode!.keys(),
      )
      query.stack.push(choicePoint)
      query.seenVars.add(term as Variable)
    }

    const result = choicePoint.iterator?.next()!
    if (result.done) {
      query.bindings.set(term as Variable, term as Term)
      query.stack.pop()
      query.fail = true
    } else {
      query.bindings.set(term as Variable, result.value)
      query.instructionPtr++
    }
  },

  medialConstant(query: Query, term: Argument): void {
    const found = (query.dbNode as Branch).get(term as Term)
    if (found) {
      query.dbNode = found
      query.instructionPtr++
    } else query.fail = true
  },

  medialOldVariable(query: Query, term: Argument): void {
    operations.medialConstant(query, query.deref(term as Variable))
  },

  finalConstant(query: Query, term: Argument): void {
    if ((query.dbNode as Twig).has(term as Term)) query.instructionPtr++
    else query.fail = true
  },

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
  let lastContext: Context | null = null

  function pattern(expr: Pattern): void {
    // assume GSPO
    const context = store.get(expr.terms[0] as Key)!

    if (lastContext && context !== lastContext) {
      program.push([operations.call, null])
      lastContext = context
    }

    if (context instanceof Clause)
      // program.push([operations.setClause, context])
      throw new Error('todo: calls')
    else program.push([operations.setIndex, context])

    expr.terms.slice(1).forEach((term, i) => {
      let op: string
      if (term.termType === 'Variable')
        if (variables.has(term)) op = 'OldVariable'
        else {
          op = 'newVariable'
          variables.add(term)
        }
      else op = 'Constant'

      if (op !== 'newVariable')
        op = (i === expr.terms.length - 1 ? 'final' : 'medial') + op

      program.push([operations[op], term])
    })
  }

  traverse(query, { pattern })

  if (lastContext! instanceof Clause) program.push([operations.call, null])
  program.push([operations.emitResult, null])

  return [program, variables]
}
