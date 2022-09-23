import { Clause } from './clause.js'
import { Branch, Leaf } from './operations.js'
import { Query } from './query.js'
import { Store } from './store.js'
import { VarMap } from './syntax.js'
import { Term, Variable } from './term.js'

export type Bindings<T extends Term = Term> = Map<Variable, T>
export type Argument = Term | Branch | Query | null
export type Operation = (m: Machine, l: Argument, r: Argument) => void
export type Instruction = [Operation, Argument, Argument]
export type Program = Instruction[]

type Pending = Map<Clause, Bindings>
type TrailItem = [Variable, Clause | null]
type DBNode = Leaf | Branch

class Environment {
  query: Query
  programP: number
  scope: Bindings
  callee: Clause
  calleeArgs: Bindings
  pending: Pending

  constructor(machine: Machine) {
    this.query = machine.query!
    this.programP = machine.programC
    this.scope = machine.scope!
    this.pending = machine.pending!
  }
}

class ChoicePoint<T = Term> {
  query: Query
  programC: number
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
    this.programC = machine.programC
    this.pending = machine.pending
    this.dbNode = machine.dbNode
    this.trailP = machine.trailP
    this.iterator = iterable[Symbol.iterator]()
  }

  isCurrent(machine: Machine): boolean {
    return !this.done && machine.programC === this.programC
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

// todo: have operations call backtrack, and main while loop increment programP

export class Machine {
  query: Query | null = null
  programC: number = 0

  scope: Bindings | null = null
  dbNode: DBNode | null = null
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  stack: ChoicePoint<any>[] = []
  stackP: number = -1
  // todo: separate AND and OR stack ptrs

  pending: Pending = new Map()

  callee: Clause | null = null
  calleeArgs: Bindings | null = null

  trail: TrailItem[] = []
  trailP: number = -1

  emit: ((b: Bindings) => void) | null = null

  constructor(public store: Store) {}

  backtrack(): boolean {
    if (this.stackP < 0) return false
    const cp = this.stack[this.stackP]
    // restore pending before unbind()
    this.pending = cp.pending
    while (this.trailP > cp.trailP) this.unbind()
    this.programC = cp.programC
    this.dbNode = cp.dbNode
    this.fail = false
    return true
  }

  deref(variable: Variable): Term {
    const found = this.scope!.get(variable)!
    if (found instanceof Variable)
      return found === variable ? found : this.derefCallee(found)
    else return found
  }

  derefCallee(variable: Variable): Term {
    const found = this.calleeArgs!.get(variable)!
    if (found instanceof Variable)
      return found === variable ? found : this.deref(found)
    else return found
  }

  bindScope(vari: Variable, val: Term): void {
    this.scope!.set(vari, val)
    this.trailP++
    this.trail[this.trailP] = [vari, null]
  }

  bindCallee(vari: Variable, value: Term): void {
    this.calleeArgs!.set(vari, value)
    this.trailP++
    this.trail[this.trailP] = [vari, this.callee]
  }

  unbind(): void {
    const [v, clause] = this.trail[this.trailP]
    if (!clause) this.scope!.set(v, v)
    else this.pending.get(clause)!.set(v, v)
    this.trailP--
  }

  evaluate(
    query: Query,
    emit: (b: Bindings) => void = console.log,
    args: Bindings = new Map(),
  ): void {
    this.emit = emit
    this.scope = query.newScope(args)
    this.programC = 0
    this.fail = false
    while (true) {
      const [op, left, right] = query.program[this.programC]
      op(this, left, right)
      if (this.fail && !this.backtrack()) break
    }
  }

  nextChoice(): IteratorResult<Term> {
    return this.getOrPushCP(this.dbNode!.keys()).next()
  }

  protected getOrPushCP<T = Term>(it: Iterable<T>): ChoicePoint<T> {
    let out
    if (this.stackP > -1) out = this.stack[this.stackP]
    if (out?.isCurrent(this)) return out
    out = new ChoicePoint(this, it, null)
    this.pushCP(out)
    return out
  }

  protected pushCP<T = Term>(cp: ChoicePoint<T>): void {
    this.stackP++
    this.stack[this.stackP] = cp
  }
}
