import { CurlyDataSet } from './collections/data-set.js'
import { Index } from './collections/index.js'
import { Branch, Leaf } from './operations.js'
import { Query, TopLevel } from './query.js'
import { Term, Triple, Variable } from './term.js'

// import { formatInstruction as fI } from './debug.js'
// console.log(fI.name)

export type Bindings<T = Term> = Map<Variable, T>
// TODO: Does an Argument union break monomorphism? How much do I care if I'm
// gonna port all this anyways
export type Argument =
  | Term
  | CurlyDataSet
  | keyof Triple
  | number
  | null
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
  envP: number
  scopeP: number
  calleeP: number
  // no need for dbNode since we never call mid-pattern
  neededCalls: number
  lastCall: number
  memo: Index | null

  constructor(protected proc: Processor) {
    this.query = proc.query!
    this.programP = proc.programP
    this.andP = proc.andP
    this.envP = proc.envP
    this.scopeP = proc.scopeP
    this.calleeP = proc.calleeP
    this.neededCalls = proc.neededCalls
    this.lastCall = proc.lastCall
    this.memo = proc.memo
  }

  restore(): void {
    this.proc.query = this.query
    this.proc.programP = this.programP
    this.proc.andP = this.andP
    this.proc.envP = this.envP
    this.proc.scopeP = this.scopeP
    this.proc.calleeP = this.calleeP
    this.proc.neededCalls = this.neededCalls
    this.proc.lastCall = this.lastCall
    this.proc.memo = this.memo
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
    this.proc.unbind(this.trailP)
    this.proc.fail = false
  }
}

export class IteratingChoicePoint<T = Term> extends ChoicePoint {
  dbNode: DBNode | null
  // fixme: iterate over entries rather than keys, so we
  // don't have to refetch the value
  protected iterator: Iterator<T>

  constructor(proc: Processor, iterable: Iterable<T>) {
    super(proc)
    this.dbNode = proc.dbNode
    this.iterator = iterable[Symbol.iterator]()
  }

  next(): IteratorResult<T> {
    const out = this.iterator.next()
    // save an iteration by checking IteratorHasMore instead
    // of waiting for done?
    if (out.done) {
      this.proc.orP = this.orP
      this.proc.fail = true
    }
    return out
  }

  restore(): void {
    super.restore()
    this.proc.dbNode = this.dbNode
  }
}

export class MutableChoicePoint extends ChoicePoint {
  constructor(proc: Processor, public nextProgramP: number) {
    super(proc)
  }

  restore(): void {
    super.restore()
    this.proc.programP = this.nextProgramP
  }
}

export class MemoChoicePoint extends IteratingChoicePoint<Term[]> {
  isCurrent(): boolean {
    return this.lastCall === this.proc.lastCall && super.isCurrent()
  }
}

export class Processor {
  // todo: have operations call backtrack, and main while loop increment
  // programC. maybe work out negation first. or just have backtrack()
  // check for negation?

  //-- Global stuff
  stack: Environment[] = []
  andP: number = -1
  orP: number = -1

  emit: ((b: Bindings) => void) | null = null

  //-- Environment stuff
  query: Query | null = null
  programP: number = 0

  dbNode: DBNode | null = null

  // abuse of terminology: not really a heap, just sorta
  // like the WAM's heap
  heap: (Term | number)[] = []
  envP: number = -1 // start of environment
  scopeP: number = 0 // start of our args, in prev env
  calleeP: number = -1 // start of current callee's args

  neededCalls: number = 0
  lastCall: number = -1 // last call we've made

  trail: number[] = []
  trailP: number = -1

  memo: Index | null = null
  // no need to save triple in Environment, because memo-updating instructions
  // always come at end of body, after calls
  triple: Partial<Triple> = {}

  //-- Instruction-local stuff
  // instead of failing, just jump to whatever's on top of the stack?
  // maybe negation will get messy, idk. better read the WAM book.
  // maybe: set fail, fetch next instr, if 'not', then continue, else backtrack
  fail: boolean = false

  // @debug
  instrCount: number = 0
  // @debug
  callStack: [number, Query][] = []

  bind(addr: number, value: Term | number): void {
    this.heap[addr] = value
    this.trailP++
    this.trail[this.trailP] = addr
  }

  // unused?
  bindCallee(offset: number, val: Term | number): void {
    return this.bind(this.calleeP + offset, val)
  }

  bindScope(offset: number, val: Term | number): void {
    return this.bind(this.scopeP + offset, val)
  }

  deref(addr: number): Term | number {
    while (true) {
      const found = this.heap[addr]
      if (typeof found === 'number' && found !== addr) addr = found
      else return found
    }
  }

  derefCallee(offset: number): Term | number {
    return this.deref(this.calleeP + offset)
  }

  derefScope(offset: number): Term | number {
    return this.deref(this.scopeP + offset)
  }

  evaluate(
    query: TopLevel,
    emit: (b: Bindings) => void = console.log,
    args: Bindings = new Map(),
  ): void {
    this.query = query
    this.callStack.push([0, query])
    this.initArgs(args)
    this.fail = false
    this.emit = emit
    while (true) {
      const i = this.query.program[this.programP]
      i[0](this, i[1], i[2])
      if (this.fail) {
        if (this.orP < 0) break
        this.stack[this.orP].restore()
      } else this.programP++
      this.instrCount++
    }
  }

  // @debug
  step() {
    if (this.fail) {
      if (this.orP < 0) return
      this.stack[this.orP].restore()
      return
    }
    const i = this.query!.program[this.programP]
    i[0](this, i[1], i[2])
    if (!this.fail) this.programP++
  }

  initArgs(args: Bindings): void {
    this.callStack.push([0, this.query!])
    for (let prev of this.query!.scope) {
      let next: Term | undefined
      while (true) {
        next = args.get(prev)
        if (!(next instanceof Variable)) break
        prev = next
      }
      this.heap.push(next ?? this.query!.scope.indexOf(prev))
    }
    this.envP = this.heap.length
    for (let i = this.envP; i < this.envP + this.query!.envSize; i++)
      this.heap[i] = i
  }

  nextChoice<T = Term>(
    // instead of using a thunk, maybe move more of the flow of control
    // of this method into the operations?
    iterable: () => Iterable<any> = () => this.dbNode!.keys(),
    klass: new (
      p: Processor,
      it: Iterable<T>,
    ) => IteratingChoicePoint<T> = IteratingChoicePoint,
  ): IteratorResult<T> {
    let cp = this.stack[this.orP] as IteratingChoicePoint<T>
    if (!cp || !cp.isCurrent()) {
      cp = new klass(this, iterable())
      this.orP = Math.max(this.andP, this.orP) + 1
      this.stack[this.orP] = cp
    }
    return cp.next()
  }

  unbind(prevTrailP: number): void {
    while (this.trailP > prevTrailP) {
      const binding = this.trail[this.trailP]
      this.heap[binding] = binding
      this.trailP--
    }
  }
}
