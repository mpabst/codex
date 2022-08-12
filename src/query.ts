import { Clause } from './clause.js'
import { Branch, Index, Node, Twig } from './collections/index.js'
import { compile } from './compile.js'
import { Context, Store } from './store.js'
import { Expression } from './syntax.js'
import { Term, Variable } from './term.js'

export type Bindings<T extends Term = Term> = Map<Variable, T>
type VarMap = Bindings<Variable>
export type Argument = Term | Context | null
export type Operation = (m: Query, t: Argument) => void
type Instruction = [Operation, Argument]
export type Program = Instruction[]

type Keyable = { keys: () => Iterator<Term> }

export enum Side {
  Caller,
  Callee,
}

export class ChoicePoint {
  public pc: number
  public clause: Clause | null
  public dbNode: Node | null
  public trail: Variable | null = null
  public side: Side | null = null

  constructor(query: Query, public iterator: Iterator<Term>) {
    this.pc = query.pc
    this.clause = query.clause
    this.dbNode = query.dbNode
  }
}

export class Query {
  incoming: VarMap
  returning: VarMap = new Map()

  program: Program
  pc: number = 0

  dbNode: Node | null = null
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  scope: Bindings = new Map()
  stack: ChoicePoint[] = []

  clause: Clause | null = null
  // just reach into clause.scope?
  calling: Bindings = new Map()

  emit: ((b: Bindings) => void) | null = null

  iFound: Term | null = null

  constructor(public store: Store, source: Expression) {
    const [program, variables] = compile(store, source)
    this.program = program
    this.incoming = variables
    for (const [k, v] of variables) {
      this.returning.set(v, k)
      this.scope.set(v, v)
    }
  }

  backtrack(): boolean {
    const length = this.stack.length
    if (length === 0) return false
    const choicePoint = this.stack[length - 1]
    this.pc = choicePoint.pc
    this.clause = choicePoint.clause
    this.dbNode = choicePoint.dbNode
    this.fail = false
    return true
  }

  deref(variable: Variable): Term {
    const found = this.scope.get(variable)!
    if (found.termType === 'Variable')
      return found === variable ? found : this.derefCalling(found as Variable)
    else return found
  }

  derefCalling(variable: Variable): Term {
    const found = this.calling.get(variable)!
    return found.termType === 'Variable' ? this.deref(found as Variable) : found
  }

  evaluate(
    emit: (b: Bindings) => void = console.log,
    args: Bindings = new Map(),
  ): void {
    this.emit = emit
    for (const [k, v] of args) this.scope.set(k, v)
    while (true) {
      const instruction = this.program[this.pc]
      instruction[0](this, instruction[1])
      if (this.fail && !this.backtrack()) break
    }

    // only unbind vars which were unbound at start of eval
    for (const k of args.keys()) this.scope.set(k, k)

    this.emit = null
  }

  next(it: Keyable): IteratorResult<Term> {
    return this.peek(it).iterator?.next()!
  }

  peek(it: Keyable): ChoicePoint {
    let out = this.stack[this.stack.length - 1]
    if (!out || out.pc !== this.pc) {
      out = new ChoicePoint(this, it.keys())
      this.stack.push(out)
    }
    return out
  }

  pop(): void {
    this.stack.pop()
    this.fail = true
  }
}

function advanceMedial(query: Query, term: Argument): void {
  query.dbNode = (query.dbNode as Branch).get(term as Term)!
  query.pc++
}

function advanceFinal(query: Query, term: Argument): void {
  query.dbNode = null
  query.pc++
}

function eAnonVar(query: Query, advance: Operation): void {
  const result = query.next(query.dbNode!)
  if (result.done) query.pop()
  else advance(query, result.value)
}

function eNewVar(query: Query, term: Argument, advance: Operation): void {
  const result = query.next(query.dbNode!)
  if (result.done) {
    query.scope.set(term as Variable, term as Term)
    query.pop()
  } else {
    query.scope.set(term as Variable, result.value)
    advance(query, result.value)
  }
}

export const operations: { [k: string]: Operation } = {
  setClause(query: Query, clause: Argument): void {
    query.clause = clause as Clause
    query.dbNode = (clause as Clause).head.getOrder('SPO')
    query.pc++
  },

  setIndex(query: Query, index: Argument): void {
    query.dbNode = (index as Index).getOrder('SPO')
    query.pc++
  },

  medialEConst(query: Query, term: Argument): void {
    const found = (query.dbNode as Branch).get(term as Term)
    if (found) {
      query.dbNode = found
      query.pc++
    } else query.fail = true
  },

  medialENewVar(query: Query, term: Argument): void {
    eNewVar(query, term, advanceMedial)
  },

  medialEOldVar(query: Query, term: Argument): void {
    const found = query.deref(term as Variable)
    if (found.termType === 'Variable') operations.medialENewVar(query, found)
    else operations.medialEConst(query, found)
  },

  medialEAnonVar(query: Query, term: Argument): void {
    eAnonVar(query, advanceMedial)
  },

  finalEConst(query: Query, term: Argument): void {
    if ((query.dbNode as Twig).has(term as Term)) query.pc++
    else query.fail = true
  },

  finalENewVar(query: Query, term: Argument): void {
    eNewVar(query, term, advanceFinal)
  },

  finalEOldVar(query: Query, term: Argument): void {
    const found = query.deref(term as Variable)
    if (found.termType === 'Variable') operations.finalENewVar(query, found)
    else operations.finalEConst(query, found)
  },

  call(query: Query, term: Argument): void {
    query.clause = null
    query.calling = new Map()
  },

  emitResult(query: Query, term: Argument): void {
    query.emit!(new Map(query.scope))
    query.fail = !query.backtrack()
  },
}
