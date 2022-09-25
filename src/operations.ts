import { Clause } from './clause.js'
import {
  Argument,
  Operation,
  Machine,
  ScopedBindings,
  ScopedBinding,
} from './machine.js'
import { Term, Variable } from './term.js'

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
      operations.eMedialNewVar(machine, found, null)
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
    const found = machine.deref([null, term as Variable])
    if (found instanceof Variable) operations.eFinalNewVar(machine, found, null)
    else operations.eFinalConst(machine, found, null)
  },

  iConstVar(machine: Machine, caller: Argument, callee: Argument): void {
    const found = machine.deref([machine.callee, callee as Variable])
    if (found[1] instanceof Variable) {
      machine.bind(found as ScopedBinding<Variable>, [null, caller as Term])
      machine.programP++
    } else if (found[1] === caller) machine.programP++
    else machine.fail = true
  },

  iNewVarConst(machine: Machine, caller: Argument, callee: Argument): void {
    machine.bind([null, caller as Variable], [null, callee as Term])
    machine.programP++
  },

  iNewVarVar(machine: Machine, caller: Argument, callee: Argument): void {
    machine.bind(
      [null, caller as Variable],
      machine.deref([machine.callee, callee as Variable]),
    )
    machine.programP++
  },

  iOldVarConst(machine: Machine, caller: Argument, callee: Argument): void {
    const found = machine.deref([null, caller as Variable])
    if (found[1] instanceof Variable)
      machine.bind(found as ScopedBinding<Variable>, [null, callee as Term])
    else if (found[1] !== callee) {
      machine.fail = true
      return
    }
    machine.programP++
  },

  iOldVarVar(machine: Machine, caller: Argument, callee: Argument): void {
    const erFound = machine.deref([machine.query, caller as Variable])
    const eeFound = machine.deref([machine.callee, callee as Variable])
    // caller is bound, callee is unbound
    if (eeFound[1] === callee)
      machine.bind([machine.callee, callee as Variable], erFound)
    // both are bound, caller's referent is const, callee's is var
    else if (eeFound[1] instanceof Variable)
      machine.bind(eeFound as ScopedBinding<Variable>, erFound)
    // both bound, callee's referent is const but caller's is var
    else if (erFound[1] instanceof Variable)
      machine.bind(erFound as ScopedBinding<Variable>, eeFound)
    // both bound to consts
    else if (erFound[1] !== eeFound[1]) {
      machine.fail = true
      return
    }
    machine.programP++
  },
}
