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
  public instructionPtr: number
  public clause: Clause | null
  public dbNode: Node | null

  constructor(query: Query, public iterator: Iterator<Term> | null) {
    this.instructionPtr = query.instructionPtr
    this.clause = query.clause
    this.dbNode = query.dbNode
  }
}

export class Query {
  program: Program
  instructionPtr: number = 0

  dbNode: Node | null = null
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  bindings: Bindings = new Map()
  stack: ChoicePoint[] = []

  clause: Clause | null = null
  args: Bindings = new Map()

  emit: ((b: Bindings) => void) | null = null

  incoming: Map<Variable, Variable>
  outgoing = new Map<Variable, Variable>()

  constructor(public store: Store, source: Expression) {
    const [program, variables] = compile(store, source)
    this.program = program
    this.incoming = variables
    for (const [k, v] of variables) {
      this.outgoing.set(v, k)
      this.bindings.set(v, v)
    }
  }

  backtrack(): boolean {
    const length = this.stack.length
    if (length === 0) return false
    const choicePoint = this.stack[length - 1]
    this.instructionPtr = choicePoint.instructionPtr
    this.clause = choicePoint.clause
    this.dbNode = choicePoint.dbNode
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

  evaluate(
    emit: (b: Bindings) => void = console.log,
    bindings: Bindings = new Map(),
  ): void {
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

  pushChoicePoint(it: Iterator<Term>): ChoicePoint {
    const out = new ChoicePoint(this, it)
    this.stack.push(out)
    return out
  }
}

function getNext(query: Query, it: Iterator<Term>): IteratorResult<Term> {
  let choicePoint = query.stack[query.stack.length - 1]
  if (!choicePoint || choicePoint.instructionPtr !== query.instructionPtr)
    choicePoint = query.pushChoicePoint(it)
  return choicePoint.iterator?.next()!
}

function advanceMedial(query: Query, term: Term): void {
  query.dbNode = (query.dbNode as Branch).get(term)!
  query.instructionPtr++
}

function advanceFinal(query: Query, term: Term): void {
  query.dbNode = null
  query.instructionPtr++
}

function noMore(query: Query): void {
  query.stack.pop()
  query.fail = true
}

function anonVariable(
  query: Query,
  advanceNode: (q: Query, t: Term) => void,
): void {
  const result = getNext(query, query.dbNode!.keys())
  if (result.done) noMore(query)
  else advanceNode(query, result.value)
}

function newVariable(
  query: Query,
  term: Argument,
  advanceNode: (q: Query, t: Term) => void,
): void {
  const result = getNext(query, query.dbNode!.keys())
  if (result.done) {
    query.bindings.set(term as Variable, term as Term)
    noMore(query)
  } else {
    query.bindings.set(term as Variable, result.value)
    advanceNode(query, result.value)
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

  medialNewVariable(query: Query, term: Argument): void {
    newVariable(query, term, advanceMedial)
  },

  medialOldVariable(query: Query, term: Argument): void {
    operations.medialConstant(query, query.deref(term as Variable))
  },

  medialAnonVariable(query: Query, term: Argument): void {
    anonVariable(query, advanceMedial)
  },

  finalConstant(query: Query, term: Argument): void {
    if ((query.dbNode as Twig).has(term as Term)) query.instructionPtr++
    else query.fail = true
  },

  finalNewVariable(query: Query, term: Argument): void {
    newVariable(query, term, advanceFinal)
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
    query.fail = !query.backtrack()
  },
}
