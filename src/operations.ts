import { Memo, MemoItem } from './collections/data-set.js'
import { Callee } from './compiler/general.js'
import {
  Argument,
  Bindings,
  Environment,
  IteratingChoicePoint,
  MemoChoicePoint,
  MutableChoicePoint,
  Operation,
  Processor,
} from './processor.js'
import { ANON, Term, Variable } from './term.js'

export type Leaf = Set<Term> | Map<Term, number>
export type Branch = Map<Term, Leaf> | Map<Term, Map<Term, Leaf>>

export const operations: { [k: string]: Operation } = {
  tryMeElse(proc: Processor, nextProgramP: Argument, _: Argument): void {
    const cp = new MutableChoicePoint(proc, nextProgramP as number)
    proc.orP = Math.max(proc.andP, proc.orP) + 1
    proc.stack[proc.orP] = cp
  },

  retryMeElse(proc: Processor, nextProgramP: Argument, _: Argument): void {
    ;(proc.stack[proc.orP] as MutableChoicePoint).nextProgramP =
      nextProgramP as number
  },

  trustMe(proc: Processor, _: Argument, __: Argument): void {
    proc.orP = (proc.stack[proc.orP] as MutableChoicePoint).orP
  },

  skip(proc: Processor, programP: Argument, _: Argument): void {
    proc.programP = programP as number
  },

  // todo: external calls? JS or WASM? math, findall, etc
  // can just be another clause with a special body that has one instruction
  doCalls(proc: Processor, _: Argument, __: Argument): void {
    function bindMemo(result: Term[]) {
      for (let i = 0; i < result.length; i++) {
        const derefed = proc.derefCallee(i)
        if (typeof derefed === 'number') proc.bind(derefed, result[i])
      }
    }

    function invoke() {
      proc.andP = Math.max(proc.andP, proc.orP) + 1
      proc.stack[proc.andP] = new Environment(proc)
      proc.scopeP = proc.envP + callee.offset
      proc.envP = proc.envP + proc.query!.envSize
      proc.query = callee.target.body
      for (let i = proc.envP; i < proc.envP + proc.query!.envSize; i++)
        proc.heap[i] = i
      proc.programP = -1
    }

    function memoKey(): Term[] {
      const key = proc.heap.slice(proc.calleeP, proc.calleeP + memo!.pathLength)
      const outArgs = new Map<number, Variable>()

      for (let i = 0; i < key.length; i++)
        if (typeof key[i] === 'number') {
          const derefed = proc.deref(key[i] as number)
          if (typeof derefed === 'number') {
            let first = outArgs.get(derefed)
            if (!first) {
              // todo: allow numbers in memo keys? mostly to avoid
              // this next line
              first = callee!.target.vars[i]
              outArgs.set(derefed, first)
            }
            key[i] = first
          } else key[i] = derefed
        }

      return key as Term[]
    }

    if (proc.lastMade === proc.lastSched) return

    const cp = proc.stack[proc.orP] as IteratingChoicePoint
    if (cp && cp.isCurrent()) {
      const { done, value } = (cp as MemoChoicePoint).next()
      if (!done) bindMemo(value)
      return
    }

    // haven't made the call yet, so let's do that
    proc.lastMade++
    const callee = proc.callees[proc.lastMade]

    // check memo
    const memo = callee.target.memo
    // unmemoized clause
    // todo: eliminate this branch by having callee stack accumulate the
    // instruction used to call that specific clause. also seems like a
    // good design more generally
    if (memo === null) {
      invoke()
      return
    }

    const key = memoKey()
    const memoItem = memo.get(key)
    if (memoItem) {
      const { done, value } = proc.nextChoice(
        () => memoItem.bindings,
        MemoChoicePoint,
      )
      if (!done) bindMemo(value)
    } else {
      // todo: have get() be an upsert which adds an empty MemoItem, and stash
      // that on proc instead of the key
      proc.memoKey = key
      invoke()
    }
  },

  updateMemo(proc: Processor, memo: Argument, _: Argument): void {
    let memoItem = (memo as Memo).get(proc.memoKey!)
    if (!memoItem) {
      memoItem = new MemoItem()
    }
  },

  return(proc: Processor, _: Argument, __: Argument): void {
    if (proc.andP < 0) proc.fail = true
    else proc.stack[proc.andP].restore()
  },

  emitResult(proc: Processor, _: Argument, __: Argument): void {
    const binds: Bindings = new Map()
    for (const i in proc.query!.scope)
      // scopeP isn't necessary in the index to proc.heap since we're at
      // top-level
      binds.set(proc.query!.scope[i], proc.heap[i] as Term)
    proc.emit!(binds)
    proc.fail = true
  },

  setCallee(proc: Processor, calleeP: Argument, calleeIndex: Argument): void {
    proc.calleeP = proc.envP + (calleeP as number)
    proc.neededCalls |= calleeIndex as number
  },

  setIndex(proc: Processor, branch: Argument, _: Argument): void {
    proc.dbNode = branch as Branch
  },

  eMedialConst(proc: Processor, caller: Argument, _: Argument): void {
    const found = (proc.dbNode as Branch).get(caller as Term)
    if (found) proc.dbNode = found
    else proc.fail = true
  },

  eMedialAnonVar(proc: Processor, _: Argument, __: Argument): void {
    const { done, value } = proc.nextChoice()
    if (!done) proc.dbNode = (proc.dbNode as Branch).get(value)!
  },

  eMedialNewVar(proc: Processor, caller: Argument, _: Argument): void {
    const { done, value } = proc.nextChoice()
    if (!done) {
      proc.bindScope(caller as number, value)
      proc.dbNode = (proc.dbNode as Branch).get(value)!
    }
  },

  eMedialOldVar(proc: Processor, caller: Argument, _: Argument): void {
    const found = proc.derefScope(caller as number)
    if (typeof found === 'number') {
      const { done, value } = proc.nextChoice()
      if (!done) {
        proc.bind(found, value)
        proc.dbNode = (proc.dbNode as Branch).get(value)!
      }
    } else operations.eMedialConst(proc, found, null)
  },

  eFinalConst(proc: Processor, caller: Argument, _: Argument): void {
    if (!(proc.dbNode as Leaf).has(caller as Term)) proc.fail = true
  },

  // no need for eFinalAnonVar

  eFinalNewVar(proc: Processor, caller: Argument, _: Argument): void {
    const { done, value } = proc.nextChoice()
    if (!done) proc.bindScope(caller as number, value)
  },

  eFinalOldVar(proc: Processor, caller: Argument, _: Argument): void {
    const found = proc.derefScope(caller as number)
    if (typeof found === 'number') {
      const { done, value } = proc.nextChoice()
      if (!done) proc.bind(found, value)
    } else operations.eFinalConst(proc, found, null)
  },

  iConstVar(proc: Processor, caller: Argument, callee: Argument): void {
    const eeFound = proc.derefCallee(callee as number)
    if (typeof eeFound === 'number') proc.bind(eeFound, caller as Term)
    else if (eeFound !== caller) proc.fail = true
  },

  iNewVarConst(proc: Processor, caller: Argument, callee: Argument): void {
    proc.bindScope(caller as number, callee as Term)
  },

  iNewVarVar(proc: Processor, caller: Argument, callee: Argument): void {
    const eeFound = proc.derefCallee(callee as number)
    if (typeof eeFound === 'number')
      proc.bind(eeFound, proc.scopeP + (caller as number))
    else proc.bindScope(caller as number, eeFound)
  },

  iOldVarConst(proc: Processor, caller: Argument, callee: Argument): void {
    const erFound = proc.derefScope(caller as number)
    if (typeof erFound === 'number') proc.bind(erFound, callee as Term)
    else if (erFound !== callee) proc.fail = true
  },

  iOldVarVar(proc: Processor, caller: Argument, callee: Argument): void {
    const erFound = proc.derefScope(caller as number)
    const eeFound = proc.derefCallee(callee as number)
    // callee is unbound or bound to var, caller status doesn't matter
    // (because all vars point upwards in the stack)
    if (typeof eeFound === 'number') proc.bind(eeFound, erFound)
    // callee's referent is const but caller's is var
    else if (typeof erFound === 'number') proc.bind(erFound, eeFound)
    // both bound to consts
    else if (erFound !== eeFound) proc.fail = true
    // both consts but they match: just continue
  },
}
