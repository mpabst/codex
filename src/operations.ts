import {
  Argument,
  Bindings,
  Invocation,
  MutableChoicePoint,
  Operation,
  Processor,
} from './processor.js'
import { Query } from './query.js'
import { Term } from './term.js'

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

  call(proc: Processor, scopeP: Argument, query: Argument): void {
    // todo: check memo
    proc.andP = Math.max(proc.andP, proc.orP) + 1
    proc.stack[proc.andP] = new Invocation(proc)
    proc.scopeP = proc.envP + (scopeP as number)
    proc.envP = proc.envP + proc.query!.size
    proc.query = query as Query
    for (let i = proc.envP; i < proc.envP + proc.query!.size; i++)
      proc.heap[i] = i
    proc.programP = 0
  },

  return(proc: Processor, _: Argument, __: Argument): void {
    if (proc.andP < 0) proc.fail = true
    else proc.stack[proc.andP].restore()
  },

  emitResult(proc: Processor, _: Argument, __: Argument): void {
    const binds: Bindings = new Map()
    for (const i in proc.query!.vars)
      binds.set(
        proc.query!.vars[i],
        // scopeP isn't necessary iff we're at top-level - it'll
        // always be 0 then - but this might still be handy
        proc.heap[proc.scopeP + parseInt(i)] as Term,
      )
    proc.emit!(binds)
    proc.fail = true
  },

  setCalleeP(proc: Processor, calleeP: Argument, _: Argument): void {
    proc.calleeP = proc.envP + (calleeP as number)
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
