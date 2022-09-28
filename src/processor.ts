import { Branch, Leaf, operations } from './operations.js'
import { Query } from './query.js'
import { Term, Variable } from './term.js'

export type Bindings<T = Term> = Map<Variable, T>
// TODO: Does an Argument union break monomorphism? How much do I care if I'm
// gonna port all this anyways
export type Argument = Term | Branch | Query | number | null
export type Operation = (m: Processor, l: Argument, r: Argument) => void
export type InstructionSet = { [k: string]: Operation }
export type Instruction = [Operation, Argument, Argument]
export type Program = Instruction[]
export type DBNode = Leaf | Branch

export class Environment {
  query: Query
  programP: number
  // i don't think this changes when we push a CP, but
  // it doesn't seem worth a separate subclass atm
  andP: number
  heapP: number
  scopeP: number
  argsP: number
  // no need for dbNode since we never call mid-pattern

  constructor(protected proc: Processor) {
    this.query = proc.query!
    this.programP = proc.programP
    this.andP = proc.andP
    this.heapP = proc.heapP
    this.scopeP = proc.scopeP
    this.argsP = proc.calleeP
  }

  restore(): void {
    this.proc.query = this.query
    this.proc.programP = this.programP
    this.proc.andP = this.andP
    this.proc.heapP = this.heapP
    this.proc.scopeP = this.scopeP
    this.proc.calleeP = this.argsP
  }
}

abstract class ChoicePoint extends Environment {
  orP: number
  trailP: number

  constructor(proc: Processor) {
    super(proc)
    this.orP = proc.orP
    this.trailP = proc.trailP
  }

  isCurrent(): boolean {
    return (
      this.proc.query === this.query && this.proc.programP === this.programP
    )
  }

  restore(): void {
    super.restore()
    this.proc.orP = this.orP
    while (this.proc.trailP > this.trailP) this.proc.unbind()
    this.proc.fail = false
  }
}

class IteratingChoicePoint extends ChoicePoint {
  // fixme: iterate over entries rather than keys, so we
  // don't have to refetch the value
  protected iterator: Iterator<Term>

  constructor(proc: Processor, iterable: Iterable<Term>) {
    super(proc)
    this.iterator = iterable[Symbol.iterator]()
  }

  next(): IteratorResult<Term> {
    const out = this.iterator.next()
    // save an iteration by checking IteratorHasMore instead
    // of waiting for done?
    if (out.done) {
      this.proc.orP--
      this.proc.fail = true
    }
    return out
  }
}

class MutableChoicePoint extends ChoicePoint {
  constructor(proc: Processor, public nextChoice: number) {
    super(proc)
  }
}

export class Processor {
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
  // todo: ensure environment protection applies to heap, too
  heap: (Term | number)[] = []
  heapP: number = -1 // start of environment
  scopeP: number = 0 // start of our args, in prev env
  calleeP: number = -1 // start of current callee's args

  trail: number[] = []
  trailP: number = -1

  /// Instruction-local stuff
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  backtrack(): boolean {
    if (this.orP < 0) return false
    this.stack[this.orP].restore()
    return true
  }

  protected deref(addr: number): Term | number {
    while (true) {
      const found = this.heap[addr]
      if (typeof found === 'number' && found !== addr) addr = found
      else return found
    }
  }

  derefScope(offset: number): Term | number {
    return this.deref(this.scopeP + offset)
  }

  derefCallee(offset: number): Term | number {
    return this.deref(this.calleeP + offset)
  }

  bind(addr: number, value: Term | number): void {
    this.heap[addr] = value
    this.trailP++
    this.trail[this.trailP] = addr
  }

  bindScope(offset: number, val: Term | number): void {
    return this.bind(this.scopeP + offset, val)
  }

  bindCallee(offset: number, val: Term | number): void {
    return this.bind(this.calleeP + offset, val)
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
    // fixme: don't mutate arg
    query.program.push([operations.emitResult, null, null])
    this.query = query
    this.programP = 0
    this.initArgs(args)
    this.fail = false
    this.emit = emit
    while (true) {
      const [op, left, right] = query.program[this.programP]
      op(this, left, right)
      if (this.fail && !this.backtrack()) break
      else this.programP++
    }
  }

  nextChoice(
    // instead of using a thunk, maybe move more of the flow of control
    // into the operations?
    iterable: () => Iterable<Term> = () => this.dbNode!.keys(),
  ): IteratorResult<Term> {
    let cp
    if (this.orP > -1) cp = this.stack[this.orP] as IteratingChoicePoint
    if (!cp || !cp.isCurrent()) {
      cp = new IteratingChoicePoint(this, iterable())
      this.orP = Math.max(this.andP, this.orP) + 1
      this.stack[this.orP] = cp
    }
    return cp.next()
  }
}
