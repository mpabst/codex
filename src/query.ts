import { Clause } from './clause.js'
import { Node } from './collections/index.js'
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

type TrailItem = [Variable, Side]

export class ChoicePoint<T extends Term = Term> {
  public programP: number
  public clause: Clause | null
  public dbNode: Node | null
  public trailP: number
  public current: IteratorResult<T> | null = null // move to Query?

  constructor(query: Query, public iterator: Iterator<T>) {
    this.programP = query.programP
    this.clause = query.clause
    this.dbNode = query.dbNode
    this.trailP = query.trailP
  }

  next(): IteratorResult<T> {
    this.current = this.iterator.next()
    return this.current
  }
}

export class Query {
  incoming: VarMap
  returning: VarMap = new Map()

  program: Program
  programP: number = 0

  scope: Bindings = new Map()
  dbNode: Node | null = null
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  stack: ChoicePoint[] = []
  stackP: number = -1

  trail: TrailItem[] = []
  trailP: number = -1

  clause: Clause | null = null
  // just reach into clause.scope?
  callee: Bindings = new Map()

  emit: ((b: Bindings) => void) | null = null

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
    if (this.stackP < 0) return false

    this.stackP--
    const cp = this.stack[this.stackP]

    while (this.trailP > cp.trailP) this.unbind()

    this.programP = cp.programP
    this.clause = cp.clause
    this.dbNode = cp.dbNode
    this.fail = false

    return true
  }

  // should return [var, side]
  deref(variable: Variable): Term {
    const found = this.scope.get(variable)!
    if (found.termType === 'Variable')
      return found === variable ? found : this.derefCalling(found as Variable)
    else return found
  }

  derefCalling(variable: Variable): Term {
    const found = this.callee.get(variable)!
    return found.termType === 'Variable' ? this.deref(found as Variable) : found
  }

  bindScope(vari: Variable, val: Term): void {
    this.scope.set(vari, val)
    this.trailP++
    this.trail[this.trailP] = [vari, Side.Caller]
  }

  bindCallee(vari: Variable, value: Term): void {
    this.callee.set(vari, value)
    this.trailP++
    this.trail[this.trailP] = [vari, Side.Callee]
  }

  unbind(): void {
    const [v, side] = this.trail[this.trailP]
    if (side === Side.Caller) this.scope.set(v, v)
    else this.callee.set(v, v)
    this.trailP--
  }

  evaluate(emit: (b: Bindings) => void = console.log): void {
    this.emit = emit
    while (true) {
      const [op, arg] = this.program[this.programP]
      op(this, arg)
      if (this.fail && !this.backtrack()) break
    }
    this.emit = null
  }

  nextChoice(it: Keyable): IteratorResult<Term> {
    return this.currentCP(it).iterator.next()
  }

  currentCP(it: Keyable): ChoicePoint {
    let out
    if (this.stackP > -1) out = this.stack[this.stackP]
    if (!out || out.programP !== this.programP) {
      out = new ChoicePoint(this, it.keys())
      this.stackP++
      this.stack[this.stackP] = out
    }
    return out
  }
}
