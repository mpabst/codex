import { Clause } from './clause.js'
import { Branch, Index, Twig } from './collections/index.js'
import { Argument, ChoicePoint, Operation, Query } from './query.js'
import { Term, Variable } from './term.js'

// call:
// 1. copy list of keys bound to unbound caller var -
// 2. do call, collect these out-args as caller var -> value
// 3. push choicepoint, iterate
// 4. at end of CP, unbind keys from 1, backtrack

// convert cp.trail into a stack of [var, side] pairs

function advanceMedial(query: Query, term: Argument): void {
  query.dbNode = (query.dbNode as Branch).get(term as Term)!
  query.programP++
}

function advanceFinal(query: Query, term: Argument): void {
  // query.dbNode = null
  query.programP++
}

function eAnonVar(query: Query, advance: Operation): void {
  const result = query.nextChoice(query.dbNode!)
  if (result.done) query.fail = true
  else advance(query, result.value)
}

function eNewVar(query: Query, term: Argument, advance: Operation): void {
  const result = query.nextChoice(query.dbNode!)
  if (result.done) query.fail = true
  else {
    query.bindScope(term as Variable, result.value)
    advance(query, result.value)
  }
}

function iPre(
  query: Query,
  term: Argument,
  doConst: Operation,
): ChoicePoint<Variable> | null {
  const vars = query.dbNode!.varKeys

  if (vars.size === 0) {
    doConst(query, term)
    return null
  }

  const cp = query.currentCP(vars) as ChoicePoint<Variable>
  if (!cp.current) {
    doConst(query, term)
    return null
  }

  const result = cp.next()
  if (result.done) {
    query.fail = true
    return null
  }

  return cp
}

function iConst(
  query: Query,
  caller: Argument,
  advance: Operation,
  eConst: Operation,
): void {
  const cp = iPre(query, caller, eConst)
  if (!cp) return

  const { value: callee } = cp.current!
  const proxi = query.callee.get(callee as Variable)
  if (!proxi) query.bindCallee(callee, caller as Term)
  else if (proxi.termType !== 'Variable') {
    if (proxi !== caller) {
      query.fail = true
      return
    }
  } else {
    const ulti = query.deref(proxi as Variable)
    if (ulti.termType === 'Variable')
      query.bindScope(ulti as Variable, caller as Term)
    else if (ulti !== caller) {
      query.fail = true
      return
    }
  }

  advance(query, caller)
}

function iNewVar(
  query: Query,
  caller: Argument,
  advance: Operation,
  eNewVar: Operation,
) {
  const cp = iPre(query, caller, eNewVar)
  if (!cp) return

  const { value: callee } = cp.current!
  let found = query.callee.get(callee as Variable)!
  if (found === callee) query.bindCallee(callee, caller as Term)
  else {
    if (found.termType === 'Variable') found = query.deref(found as Variable)
    query.bindScope(caller as Variable, found as Variable)
  }

  advance(query, caller)
}

function iOldVar(
  query: Query,
  term: Argument,
  advance: Operation,
  eNewVar: Operation,
  eConst: Operation,
): void {
  const found = query.deref(term as Variable)
  if (found.termType === 'Variable') iNewVar(query, found, advance, eNewVar)
  else iConst(query, found, advance, eConst)
}

export const operations: { [k: string]: Operation } = {
  setClause(query: Query, clause: Argument): void {
    query.clause = clause as Clause
    query.dbNode = (clause as Clause).head.getOrder('SPO')
    query.programP++
  },

  setIndex(query: Query, index: Argument): void {
    query.dbNode = (index as Index).getOrder('SPO')
    query.programP++
  },

  medialEConst(query: Query, term: Argument): void {
    const found = (query.dbNode as Branch).get(term as Term)
    if (found) {
      query.dbNode = found
      query.programP++
    } else query.fail = true
  },

  medialENewVar(query: Query, term: Argument): void {
    eNewVar(query, term, advanceMedial)
  },

  medialEOldVar(query: Query, term: Argument): void {
    const found = query.deref(term as Variable)
    if (found.termType === 'Variable') operations.medialENewVar(query, found)
    else operations.medialEConst(query, found)
  },

  medialEAnonVar(query: Query, term: Argument): void {
    eAnonVar(query, advanceMedial)
  },

  finalEConst(query: Query, term: Argument): void {
    if ((query.dbNode as Twig).has(term as Term)) query.programP++
    else query.fail = true
  },

  finalENewVar(query: Query, term: Argument): void {
    eNewVar(query, term, advanceFinal)
  },

  finalEOldVar(query: Query, term: Argument): void {
    const found = query.deref(term as Variable)
    if (found.termType === 'Variable') operations.finalENewVar(query, found)
    else operations.finalEConst(query, found)
  },

  call(query: Query, term: Argument): void {
    query.clause = null
    query.callee = new Map()
  },

  emitResult(query: Query, term: Argument): void {
    query.emit!(new Map(query.scope))
    query.fail = !query.backtrack()
  },
}
