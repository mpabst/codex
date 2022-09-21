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

function advanceMedial(machine: Machine, term: Argument): void {
  machine.dbNode = (machine.dbNode as Branch).get(term as Term)!
  machine.programP++
}

function advanceFinal(machine: Machine, _: Argument): void {
  machine.programP++
}

function eAnonVar(machine: Machine, advance: Operation): void {
  const { done, value } = machine.nextChoice()
  if (!done) advance(machine, value)
}

function eNewVar(machine: Machine, term: Argument, advance: Operation): void {
  const { done, value } = machine.nextChoice()
  if (!done) {
    machine.bindScope(term as Variable, value)
    advance(machine, value)
  }
}

function iConst(
  machine: Machine,
  caller: Argument,
  advance: Operation,
  eConst: Operation,
): void {
  const vars = (machine.dbNode as VTMap).varKeys

  if (vars.size === 0) {
    eConst(machine, caller)
    return
  }

  const cp = machine.getOrPushCP(vars) as ChoicePoint<Variable>
  if (!cp.constDone) {
    eConst(machine, caller)
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

function iNewVar(machine: Machine, caller: Argument, advance: Operation): void {
  const { done, value: callee } = machine.nextChoice()
  if (done) return

  if (callee instanceof Variable) {
    let found = machine.callee.get(callee)!
    if (found === callee)
      machine.bindCallee(callee, caller as Variable)
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
  advance: Operation,
  eConst: Operation,
): void {
  const found = machine.deref(term as Variable)
  if (found instanceof Variable) iNewVar(machine, found, advance)
  else iConst(machine, found, advance, eConst)
}

export const operations: { [k: string]: Operation } = {
  allocate(machine: Machine, term: Argument): void {

  },

  deallocate(machine: Machine, _: Argument): void {

  }, 

  try(machine: Machine, term: Argument): void {
    // push CP with its next instr the following retry/trust
    // set pending
  },

  retry(machine: Machine, term: Argument): void {

  },

  trust(machine: Machine, term: Argument): void {

  },

  // have setClause set pending, and follow it with a setIndex
  setClause(machine: Machine, clause: Argument): void {
    machine.pending = [clause as Clause, (clause as Clause).body.newScope(null)]
    machine.programP++
  },

  setIndex(machine: Machine, term: Argument): void {
    // have optional link phase to eliminate this pointer chasing
    machine.dbNode = machine.store.modules.get(term as Term)!.facts.getRoot('SPO')
    machine.programP++
  },

  medialEConst(machine: Machine, term: Argument): void {
    const found = (machine.dbNode as Branch).get(term as Term)
    if (found) {
      machine.dbNode = found
      machine.programP++
    } else machine.fail = true
  },

  medialENewVar(machine: Machine, term: Argument): void {
    eNewVar(machine, term, advanceMedial)
  },

  medialEOldVar(machine: Machine, term: Argument): void {
    const found = machine.deref(term as Variable)
    if (found instanceof Variable) operations.medialENewVar(machine, found)
    else operations.medialEConst(machine, found)
  },

  medialEAnonVar(machine: Machine, _: Argument): void {
    eAnonVar(machine, advanceMedial)
  },

  medialIConst(machine: Machine, term: Argument): void {
    iConst(machine, term, advanceMedial, operations.medialEConst)
  },

  medialINewVar(machine: Machine, term: Argument): void {
    iNewVar(machine, term, advanceMedial)
  },

  medialIOldVar(machine: Machine, term: Argument): void {
    iOldVar(machine, term, advanceMedial, operations.medialEConst)
  },

  finalEConst(machine: Machine, term: Argument): void {
    if ((machine.dbNode as Leaf).has(term as Term)) machine.programP++
    else machine.fail = true
  },

  finalENewVar(machine: Machine, term: Argument): void {
    eNewVar(machine, term, advanceFinal)
  },

  finalEOldVar(machine: Machine, term: Argument): void {
    const found = machine.deref(term as Variable)
    if (found instanceof Variable) operations.finalENewVar(machine, found)
    else operations.finalEConst(machine, found)
  },

  finalIConst(machine: Machine, term: Argument): void {
    iConst(machine, term, advanceFinal, operations.finalEConst)
  },

  finalINewVar(machine: Machine, term: Argument): void {
    iNewVar(machine, term, advanceFinal)
  },

  finalIOldVar(machine: Machine, term: Argument): void {
    iOldVar(machine, term, advanceFinal, operations.finalEConst)
  },

  call(machine: Machine, term: Argument): void {
    const [query, args] = machine.pending.get(term)
    machine.query = query
    machine.scope = args
    machine.programP = 0
  },

  emitResult(machine: Machine, _: Argument): void {
    machine.emit!(machine.scope!)
    machine.fail = !machine.backtrack()
  },
}
