import { Clause } from './clause.js'
import { Branch, Index, Node, Twig } from './collections/index.js'
import { compile } from './compile.js'
import { Context, Store } from './store.js'
import { Expression } from './syntax.js'
import { Term, Variable } from './term.js'

export type Bindings = Map<Variable, Term>
type Argument = Term | Context | null
type Operation = (m: Query, t: Argument) => void
type Instruction = [Operation, Argument]
export type Program = Instruction[]

class ChoicePoint {
  constructor(
    public instructionPtr: number,
    public clause: Clause | null,
    public iterator: Iterator<Term> | null,
  ) {}
}

export class Query {
  program: Program
  instructionPtr: number = 0

  dbNode: Node | null = null
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book
  fail: boolean = false

  bindings: Bindings = new Map()
  stack: ChoicePoint[] = []
  seenVars = new Set<Variable>()

  clause: Clause | null = null
  args: Bindings = new Map()

  emit: ((b: Bindings) => void) | null = null

  constructor(public store: Store, source: Expression) {
    const [program, variables] = compile(store, source)
    this.program = program
    for (const v of variables) this.bindings.set(v, v)
  }

  backtrack(): boolean {
    const length = this.stack.length
    if (length === 0) return false
    const choicePoint = this.stack[length - 1]
    this.instructionPtr = choicePoint.instructionPtr
    this.clause = choicePoint.clause
    this.fail = false
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

  evaluate(emit: (b: Bindings) => void = console.log, bindings: Bindings = new Map()): void {
    this.emit = emit
    for (const [k, v] of bindings) this.bindings.set(k, v)
    while (true) {
      const instruction = this.program[this.instructionPtr]
      instruction[0](this, instruction[1])
      if (this.fail && !this.backtrack()) break
    }
    for (const k of bindings.keys()) this.bindings.set(k, k)
    this.emit = null
  }
}

function newVariable(advanceNode: (q: Query, t: Term) => void): Operation {
  return function(query: Query, term: Argument) {
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
      advanceNode(query, result.value)
      query.instructionPtr++
    }
  }
}

export const operations: { [k: string]: Operation } = {
  setClause(query: Query, clause: Argument): void {
    query.clause = clause as Clause
    query.dbNode = (clause as Clause).head.getOrder('SPO')
    query.instructionPtr++
  },

  setIndex(query: Query, index: Argument): void {
    query.dbNode = (index as Index).getOrder('SPO')
    query.instructionPtr++
  },

  medialConstant(query: Query, term: Argument): void {
    const found = (query.dbNode as Branch).get(term as Term)
    if (found) {
      query.dbNode = found
      query.instructionPtr++
    } else query.fail = true
  },

  medialNewVariable: newVariable((q: Query, t: Term) => q.dbNode = (q.dbNode as Branch).get(t)!),

  medialOldVariable(query: Query, term: Argument): void {
    operations.medialConstant(query, query.deref(term as Variable))
  },

  finalConstant(query: Query, term: Argument): void {
    if ((query.dbNode as Twig).has(term as Term)) query.instructionPtr++
    else query.fail = true
  },

  finalNewVariable: newVariable((q: Query, t: Term) => q.dbNode = null),

  finalOldVariable(query: Query, term: Argument): void {
    operations.finalConstant(query, query.deref(term as Variable))
  },

  call(query: Query, term: Argument): void {
    query.clause = null
    query.args = new Map()
  },

  emitResult(query: Query, term: Argument): void {
    query.emit!(new Map(query.bindings))
    query.fail = !query.backtrack()
  },
}
