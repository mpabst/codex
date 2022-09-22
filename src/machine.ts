import { Clause } from './clause.js'
import { Branch, Leaf } from './operations.js'
import { Query } from './query.js'
import { Store } from './store.js'
import { VarMap } from './syntax.js'
import { Term, Triple, Variable } from './term.js'

export type Bindings<T extends Term = Term> = Map<Variable, T>
export type Argument = Term | Branch | Query | null
export type Operation = (m: Machine, l: Argument, r: Argument) => void
export type Instruction = [Operation, Argument, Argument]
export type Program = Instruction[]

enum Side {
  Caller,
  Callee,
}

// map clause name -> bindings
type Pending = [Clause, Bindings]
// [var, clause name]
type TrailItem = [Variable, Side]
type DBNode = Leaf | Branch

export class Call {
  // args
  // return pointer
}

export class ChoicePoint<T = Term> {
  query: Query
  programP: number
  pending: Pending | null
  dbNode: DBNode | null
  trailP: number

  done: boolean = false
  constDone: boolean = false

  protected iterator: Iterator<T>

  constructor(
    protected machine: Machine,
    iterable: Iterable<T>,
    public outArgs: VarMap | null,
  ) {
    this.query = machine.query!
    this.programP = machine.programP
    this.pending = machine.pending
    this.dbNode = machine.dbNode
    this.trailP = machine.trailP
    this.iterator = iterable[Symbol.iterator]()
  }

  isCurrent(machine: Machine): boolean {
    return !this.done && machine.programP === this.programP
  }

  next(): IteratorResult<T> {
    const out = this.iterator.next()
    // save an iteration by checking IteratorHasMore instead
    // of waiting for done?
    if (out.done) {
      this.done = true
      this.machine.stackP--
      this.machine.fail = true
    }
    return out
  }
}

class Environment {
  query: Query
  programP: number
  
}

export class Machine {

  query: Query | null = null
  programP: number = 0

  scope: Bindings | null = null
  dbNode: DBNode | null = null
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  stack: ChoicePoint<any>[] = []
  stackP: number = -1
  // separate AND and OR stack ptrs

  trail: TrailItem[] = []
  trailP: number = -1

  pending: Pending | null = null

  emit: ((b: Bindings) => void) | null = null

  constructor(public store: Store) {}

  get callee(): Bindings {
    return this.pending![1]
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
    if (found instanceof Variable)
      return found === variable ? found : this.derefCalling(found)
    else return found
  }

  derefCalling(variable: Variable): Term {
    const found = this.callee.get(variable)!
    return found instanceof Variable ? this.deref(found) : found
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
    query: Query,
    emit: (b: Bindings) => void = console.log,
    args: Bindings = new Map(),
  ): void {
    this.emit = emit
    this.scope = query.newScope(args)
    this.programP = 0
    this.fail = false
    while (true) {
      const [op, arg] = query.program[this.programP]
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
