import { Clause } from './clause.js'
import { Node } from './collections/index.js'
import { pull as compile } from './compile.js'
import { Context, Store } from './store.js'
import { Expression, VarMap } from './syntax.js'
import { Quad, Term, Variable } from './term.js'

export type Bindings<T extends Term = Term> = Map<Variable, T>
export type Argument = Term | Context | null
export type Operation = (m: Query, t: Argument) => void
export type Instruction = [Operation, Argument]
export type Program = Instruction[]

enum Side {
  Caller,
  Callee,
}

type Pending = [Clause, Bindings]
type TrailItem = [Variable, Side]

export class ChoicePoint<T = Term> {
  public programP: number
  public pending: Pending | null
  public dbNode: Node | null
  public trailP: number
  protected iterator: Iterator<T>
  public done: boolean = false
  public constDone: boolean = false

  constructor(
    protected query: Query,
    iterable: Iterable<T>,
    public outArgs: VarMap | null,
  ) {
    this.programP = query.programP
    this.pending = query.pending
    this.dbNode = query.dbNode
    this.trailP = query.trailP
    this.iterator = iterable[Symbol.iterator]()
  }

  isCurrent(query: Query): boolean {
    return !this.done && query.programP === this.programP
  }

  next(): IteratorResult<T> {
    const out = this.iterator.next()
    // save an iteration by checking IteratorHasMore instead
    // of waiting for done?
    if (out.done) {
      this.done = true
      this.query.stackP--
      this.query.fail = true
    }
    return out
  }
}

// rename this class Invocation, separate out varNames and program into
// a new Query class. or just implement calls on our own stack
export class Query {
  varNames: VarMap // source -> internal names

  program: Program
  programP: number = 0

  scope: Bindings | null = null
  dbNode: Node | null = null
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  stack: ChoicePoint<any>[] = []
  stackP: number = -1

  trail: TrailItem[] = []
  trailP: number = -1

  pending: Pending | null = null

  emit: ((b: Bindings) => void) | null = null

  constructor(public engine: Store, source: Expression<Quad> | null) {
    const [program, variables] = compile(engine, source)
    this.program = program
    this.varNames = variables
  }

  get callee(): Bindings {
    return this.pending![1]
  }

  newScope(args: Bindings | null): Bindings {
    const out = new Map()
    if (args)
      for (const v of this.varNames.values()) out.set(v, args.get(v) ?? v)
    else for (const v of this.varNames.values()) out.set(v, v)
    return out
  }

  backtrack(): boolean {
    if (this.stackP < 0) return false
    const cp = this.stack[this.stackP]
    // restore pending before unbind()
    this.pending = cp.pending
    while (this.trailP > cp.trailP) this.unbind()
    this.programP = cp.programP
    this.dbNode = cp.dbNode
    this.fail = false
    return true
  }

  // should return [var, side] ?
  deref(variable: Variable): Term {
    const found = this.scope!.get(variable)!
    if (found.termType === 'Variable')
      return found === variable ? found : this.derefCalling(found as Variable)
    else return found
  }

  derefCalling(variable: Variable): Term {
    const found = this.callee.get(variable)!
    return found.termType === 'Variable' ? this.deref(found as Variable) : found
  }

  bindScope(vari: Variable, val: Term): void {
    this.scope!.set(vari, val)
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
    if (side === Side.Caller) this.scope!.set(v, v)
    else this.callee.set(v, v)
    this.trailP--
  }

  evaluate(
    emit: (b: Bindings) => void = console.log,
    args: Bindings = new Map(),
  ): void {
    this.emit = emit
    this.scope = this.newScope(args)
    this.programP = 0
    this.fail = false
    while (true) {
      const [op, arg] = this.program[this.programP]
      op(this, arg)
      if (this.fail && !this.backtrack()) break
    }
  }

  nextChoice(): IteratorResult<Term> {
    return this.getOrPushCP(this.dbNode!.keys()).next()
  }

  getOrPushCP<T = Term>(it: Iterable<T>): ChoicePoint<T> {
    let out
    if (this.stackP > -1) out = this.stack[this.stackP]
    if (out?.isCurrent(this)) return out
    out = new ChoicePoint(this, it, null)
    this.pushCP(out)
    return out
  }

  pushCP<T = Term>(cp: ChoicePoint<T>): void {
    this.stackP++
    this.stack[this.stackP] = cp
  }
}
