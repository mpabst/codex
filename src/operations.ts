import { Clause } from './clause.js'
import { VTMap } from './collections/var-tracking.js'
import { Argument, ChoicePoint, Operation, Machine } from './machine.js'
import { Term, Variable } from './term.js'

// instead of dynamically branching through the heads,
// we can just do those same queries at compile time,
// and in the emitter, generate ops covering the
// combination of caller and callee terms, not just
// the former, with a bunch of branching to determine
// the latter

export type Leaf = Set<Term> | Map<Term, number>
export type Branch = Map<Term, Leaf> | Map<Term, Map<Term, Leaf>>

type Unary = (m: Machine, t: Term) => void

function advanceMedial(machine: Machine, term: Term): void {
  machine.dbNode = (machine.dbNode as Branch).get(term as Term)!
  machine.programP++
}

function advanceFinal(machine: Machine): void {
  machine.programP++
}

function eAnonVar(machine: Machine, advance: Unary): void {
  const { done, value } = machine.nextChoice()
  if (!done) advance(machine, value)
}

function eNewVar(machine: Machine, term: Argument, advance: Unary): void {
  const { done, value } = machine.nextChoice()
  if (!done) {
    machine.bindScope(term as Variable, value)
    advance(machine, value)
  }
}

function iConst(
  machine: Machine,
  caller: Argument,
  advance: Unary,
  eConst: Operation,
): void {
  const vars = (machine.dbNode as VTMap).varKeys

  if (vars.size === 0) {
    eConst(machine, caller, null)
    return
  }

  const cp = machine.getOrPushCP(vars) as ChoicePoint<Variable>
  if (!cp.constDone) {
    eConst(machine, caller, null)
    cp.constDone = true
    return
  }

  const { done, value: callee } = cp.next()
  if (done) return

  const proximate = machine.callee.get(callee as Variable)

  if (!proximate) machine.bindCallee(callee, caller as Term)
  else if (!(proximate instanceof Variable)) {
    if (proximate !== caller) {
      machine.fail = true
      return
    }
  } else {
    const ultimate = machine.deref(proximate)
    if (ultimate instanceof Variable)
      machine.bindScope(ultimate, caller as Term)
    else if (ultimate !== caller) {
      machine.fail = true
      return
    }
  }

  advance(machine, callee)
}

function iNewVar(machine: Machine, caller: Argument, advance: Unary): void {
  const { done, value: callee } = machine.nextChoice()
  if (done) return

  if (callee instanceof Variable) {
    let found = machine.callee.get(callee)!
    if (found === callee) machine.bindCallee(callee, caller as Variable)
    else {
      if (found instanceof Variable) found = machine.deref(found)
      machine.bindScope(caller as Variable, found)
    }
  } else machine.bindScope(caller as Variable, callee)

  advance(machine, callee)
}

function iOldVar(
  machine: Machine,
  term: Argument,
  advance: Unary,
  eConst: Operation,
): void {
  const found = machine.deref(term as Variable)
  if (found instanceof Variable) iNewVar(machine, found, advance)
  else iConst(machine, found, advance, eConst)
}

export const operations: { [k: string]: Operation } = {
  allocate(machine: Machine, term: Argument, _: Argument): void {},

  deallocate(machine: Machine, _term: Argument, _: Argument): void {},

  try(machine: Machine, term: Argument, _: Argument): void {
    // push CP with its next instr the following retry/trust
    // set pending
  },

  retry(machine: Machine, term: Argument, _: Argument): void {},

  trust(machine: Machine, term: Argument, _: Argument): void {},

  call(machine: Machine, term: Argument, _: Argument): void {
    const [query, args] = machine.pending.get(left)
    machine.query = query
    machine.scope = args
    machine.programP = 0
  },

  emitResult(machine: Machine, _: Argument): void {
    machine.emit!(machine.scope!)
    machine.fail = !machine.backtrack()
  },

  // have setClause set pending, and follow it with a setIndex
  setClause(machine: Machine, clause: Argument): void {
    machine.pending = [clause as Clause, (clause as Clause).body.newScope(null)]
    machine.programP++
  },

  setIndex(machine: Machine, branch: Argument, _: Argument): void {
    machine.dbNode = branch as Branch
    machine.programP++
  },

  eMedialConst(machine: Machine, term: Argument, _: Argument): void {
    const found = (machine.dbNode as Branch).get(term as Term)
    if (found) {
      machine.dbNode = found
      machine.programP++
    } else machine.fail = true
  },

  eMedialNewVar(machine: Machine, term: Argument, _: Argument): void {
    eNewVar(machine, term, advanceMedial)
  },

  eMedialOldVar(machine: Machine, term: Argument, _: Argument): void {
    const found = machine.deref(term as Variable)
    if (found instanceof Variable)
      operations.medialENewVar(machine, found, null)
    else operations.eMedialConst(machine, found, null)
  },

  eMedialAnonVar(machine: Machine, _: Argument): void {
    eAnonVar(machine, advanceMedial)
  },

  eFinalConst(machine: Machine, term: Argument, _: Argument): void {
    if ((machine.dbNode as Leaf).has(term as Term)) machine.programP++
    else machine.fail = true
  },

  eFinalNewVar(machine: Machine, term: Argument, _: Argument): void {
    eNewVar(machine, term, advanceFinal)
  },

  eFinalOldVar(machine: Machine, term: Argument, _: Argument): void {
    const found = machine.deref(term as Variable)
    if (found instanceof Variable) operations.eFinalNewVar(machine, found, null)
    else operations.eFinalConst(machine, found, null)
  },

  iConstVar(machine: Machine, caller: Argument, callee: Argument): void {
    const bound = machine.callee.get(callee as Variable)
    if (bound === callee) {
      machine.bindCallee(callee as Variable, caller as Term)
      machine.programP++
    } else if (bound === caller) machine.programP++
    else machine.fail = true
  },

  iNewVarConst(machine: Machine, caller: Argument, callee: Argument): void {
    machine.bindScope(caller as Variable, callee as Term)
    machine.programP++
  },

  iNewVarVar(machine: Machine, caller: Argument, callee: Argument): void {
    const bound = machine.callee.get(callee as Variable)!
    if (bound === callee) machine.bindCallee(callee as Variable, caller as Term)
    else machine.bindScope(caller as Variable, bound)
    machine.programP++
  },

  iOldVarConst(machine: Machine, caller: Argument, callee: Argument): void {
    if (machine.scope!.get(caller as Variable) === callee) machine.programP++
    else machine.fail = true
  },

  iOldVarVar(machine: Machine, caller: Argument, callee: Argument): void {
    const erBound = machine.scope!.get(caller as Variable)!
    const eeBound = machine.callee.get(callee as Variable)!
    // callee is unbound
    if (eeBound === callee)
      machine.bindCallee(callee as Variable, erBound as Term)
    // callee is bound, caller is unbound
    else if (erBound === caller) machine.bindScope(caller as Variable, eeBound)
    // both are bound
    else if (erBound !== eeBound) {
      machine.fail = true
      return
    }
    machine.programP++
  },
}
