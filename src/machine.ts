import { Clause } from './clause.js'
import { Branch, Leaf } from './operations.js'
import { Query } from './query.js'
import { Store } from './store.js'
import { Term, Variable } from './term.js'

export type Bindings<T = Term> = Map<Variable, T>
export type ScopedBindings<T extends Term = Term> = Bindings<ScopedBinding<T>>
export type Argument = Term | Branch | Query | null
export type Operation = (m: Machine, l: Argument, r: Argument) => void
export type Instruction = [Operation, Argument, Argument]
export type Program = Instruction[]

type ScopedBinding<T extends Term = Term> = [Clause | null, T]
type Pending = Map<Clause, ScopedBindings>
type DBNode = Leaf | Branch

class Environment {
  query: Query
  programP: number
  scope: ScopedBindings
  pending: Pending
  trailP: number

  constructor(machine: Machine) {
    this.query = machine.query!
    this.programP = machine.programP
    this.scope = machine.scope!
    this.pending = machine.pending!
    this.trailP = machine.trailP
  }
}

abstract class ChoicePoint {
  query: Query
  programP: number
  scope: ScopedBindings
  pending: Pending
  trailP: number

  constructor(public machine: Machine) {
    this.query = machine.query!
    this.programP = machine.programP
    this.scope = machine.scope!
    this.pending = machine.pending
    this.trailP = machine.trailP
  }

  isCurrent(machine: Machine): boolean {
    return machine.query === this.query && machine.programP === this.programP
  }

  restore(): void {
    this.machine.query = this.query
    this.machine.programP = this.programP
    this.machine.scope = this.scope
    // restore pending before unbind()
    this.machine.pending = this.pending
    while (this.machine.trailP > this.trailP) this.machine.unbind()
    this.machine.fail = false
  }
}

class IteratingChoicePoint extends ChoicePoint {
  protected iterator: Iterator<Term>

  constructor(machine: Machine) {
    super(machine)
    this.iterator = machine.dbNode!.keys()
  }

  next(): IteratorResult<Term> {
    const out = this.iterator.next()
    // save an iteration by checking IteratorHasMore instead
    // of waiting for done?
    if (out.done) {
      this.machine.orP--
      this.machine.fail = true
    }
    return out
  }
}

class MutableChoicePoint extends ChoicePoint {
  constructor(machine: Machine, public nextChoice: number) {
    super(machine)
  }
}

export class Machine {
  // todo: have operations call backtrack, and main while loop increment
  // programC. maybe work out negation first. or just have backtrack()
  // check for negation?

  /// Global stuff
  stack: ChoicePoint[] = []
  andP: number = -1
  orP: number = -1

  emit: ((b: ScopedBindings) => void) | null = null

  /// Environment stuff
  query: Query | null = null
  programP: number = -1

  scope: ScopedBindings | null = null
  dbNode: DBNode | null = null

  pending: Pending = new Map()
  callee: Clause | null = null
  calleeArgs: ScopedBindings | null = null

  trail: ScopedBinding<Variable>[] = []
  trailP: number = -1

  /// Instruction-local stuff
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  constructor(public store: Store) {}

  backtrack(): boolean {
    if (this.orP < 0) return false
    this.stack[this.orP].restore()
    return true
  }

  deref([clause, variable]: ScopedBinding<Variable>): ScopedBinding {
    const found = clause
      ? this.pending.get(clause)!.get(variable)!
      : this.scope!.get(variable)!
    if (found[1] instanceof Variable)
      return found[1] === variable
        ? found
        : this.deref(found as ScopedBinding<Variable>)
    else return found
  }

  bind(vari: ScopedBinding<Variable>, value: ScopedBinding): void {
    if (vari[0]) this.scope!.set(vari[1], value)
    else this.pending.get(vari[0]!)!.set(vari[1], value)!
    this.trailP++
    this.trail[this.trailP] = vari
  }

  unbind(): void {
    const binding = this.trail[this.trailP]
    const [clause, variable] = binding
    if (!clause) this.scope!.set(variable, [null, variable])
    else this.pending.get(clause)!.set(variable, [clause, variable])
    this.trailP--
  }

  evaluate(
    query: Query,
    emit: (b: ScopedBindings) => void = console.log,
    args: Bindings = new Map(),
  ): void {
    this.emit = emit
    this.scope = query.newScope(args)
    this.programP = 0
    this.fail = false
    while (true) {
      const [op, left, right] = query.program[this.programP]
      op(this, left, right)
      if (this.fail && !this.backtrack()) break
    }
  }

  nextChoice(): IteratorResult<Term> {
    let cp
    if (this.orP > -1) cp = this.stack[this.orP] as IteratingChoicePoint
    if (!cp?.isCurrent(this)) {
      cp = new IteratingChoicePoint(this)
      this.orP = Math.max(this.andP, this.orP) + 1
      this.stack[this.orP] = cp
    }
    return cp.next()
  }
}
