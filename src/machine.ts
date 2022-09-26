import { Branch, Leaf } from './operations.js'
import { Query } from './query.js'
import { Term, Variable } from './term.js'

export type ScopedBinding<T extends Term = Term> = [Query, T]
export type Bindings<T = Term> = Map<Variable, T>
export type ScopedBindings<T extends Term = Term> = Bindings<ScopedBinding<T>>
export type Argument = Term | Branch | Query | number | null
export type Operation = (m: Machine, l: Argument, r: Argument) => void
export type Instruction = [Operation, Argument, Argument]
export type Program = Instruction[]

type DBNode = Leaf | Branch

class Environment {
  query: Query
  programP: number
  heapP: number
  scopeP: number
  argsP: number

  constructor(machine: Machine) {
    this.query = machine.query!
    this.programP = machine.programP
    this.heapP = machine.heapP
    this.scopeP = machine.scopeP
    this.argsP = machine.argsP
  }

  restore(machine: Machine): void {
    machine.query = this.query
    machine.programP = this.programP
    machine.heapP = this.heapP
    machine.scopeP = this.scopeP
    machine.argsP = this.argsP
  }
}

abstract class ChoicePoint extends Environment {
  trailP: number

  constructor(machine: Machine) {
    super(machine)
    this.trailP = machine.trailP
  }

  isCurrent(machine: Machine): boolean {
    return machine.query === this.query && machine.programP === this.programP
  }

  restore(machine: Machine): void {
    super.restore(machine)
    while (machine.trailP > this.trailP) machine.unbind()
    machine.fail = false
  }
}

class IteratingChoicePoint extends ChoicePoint {
  protected iterator: Iterator<Term>

  constructor(machine: Machine) {
    super(machine)
    this.iterator = machine.dbNode!.keys()
  }

  next(machine: Machine): IteratorResult<Term> {
    const out = this.iterator.next()
    // save an iteration by checking IteratorHasMore instead
    // of waiting for done?
    if (out.done) {
      machine.orP--
      machine.fail = true
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
  stack: Environment[] = []
  andP: number = -1
  orP: number = -1

  emit: ((b: Bindings) => void) | null = null

  /// Environment stuff
  query: Query | null = null
  programP: number = -1

  dbNode: DBNode | null = null

  // abuse of terminology: not really a heap, just sorta
  // like the WAM's heap
  heap: (Term | number)[] = []
  heapP: number = -1 // start of environment
  scopeP: number = 0 // start of our args, in prev env
  argsP: number = -1 // start of current callee's args

  trail: number[] = []
  trailP: number = -1

  /// Instruction-local stuff
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  backtrack(): boolean {
    if (this.orP < 0) return false
    this.stack[this.orP].restore(this)
    return true
  }

  // todo: avoid branching in deref() and bind() by also having special-case
  // implementations for this.scope and this.calleeArgs
  deref(addr: number): Term | number {
    while (true) {
      const found = this.heap[addr]
      if (typeof found === 'number' && found !== addr) addr = found
      else return found
    }
  }

  bind(addr: number, value: Term | number): void {
    this.heap[addr] = value
    this.trailP++
    this.trail[this.trailP] = addr
  }

  unbind(): void {
    const binding = this.trail[this.trailP]
    this.heap[binding] = binding
    this.trailP--
  }

  initArgs(args: Bindings): void {
    for (let prev of this.query!.vars) {
      let next: Term | undefined
      while (true) {
        next = args.get(prev)
        if (!(next instanceof Variable)) break
        prev = next
      }
      if (!next) this.heap.push(this.query!.vars.indexOf(prev))
      else this.heap.push(next)
    }
    this.heapP = this.heap.length
  }

  evaluate(
    query: Query,
    emit: (b: Bindings) => void = console.log,
    args: Bindings = new Map(),
  ): void {
    this.query = query
    this.programP = 0
    this.initArgs(args)
    this.fail = false
    this.emit = emit
    while (true) {
      const [op, left, right] = query.program[this.programP]
      op(this, left, right)
      if (this.fail && !this.backtrack()) break
    }
  }

  nextChoice(): IteratorResult<Term> {
    let cp
    if (this.orP > -1) cp = this.stack[this.orP] as IteratingChoicePoint
    if (!cp || !cp.isCurrent(this)) {
      cp = new IteratingChoicePoint(this)
      this.orP = Math.max(this.andP, this.orP) + 1
      this.stack[this.orP] = cp
    }
    return cp.next(this)
  }
}
