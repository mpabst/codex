import { Argument, ChoicePoint, Operation, Query } from './query.js'
import { Term, Variable } from './term.js'

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
  if (!cp.current) query.unbind()

  const result = cp.next()
  if (result.done) {
    query.stack.pop()
    doConst(query, term)
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

// call:
// 1. copy list of keys bound to unbound caller var -
// 2. do call, collect these out-args as caller var -> value
// 3. push choicepoint, iterate
// 4. at end of CP, unbind keys from 1, backtrack

// convert cp.trail into a stack of [var, side] pairs
