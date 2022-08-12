import { Argument, ChoicePoint, Operation, Query, Side } from './query.js'
import { Term, Variable } from './term.js'

function iTerm(
  query: Query,
  term: Argument,
  doConst: Operation,
  doVar: (cp: ChoicePoint, r: IteratorResult<Variable>) => void,
): void {
  const options = query.dbNode!.varKeys

  if (options.size === 0) {
    doConst(query, term)
    return
  }

  const cp = query.peek(options)
  if (cp.trail) {
    if (cp.side === Side.Caller) query.scope.set(cp.trail, cp.trail)
    else query.calling.delete(cp.trail)
  }

  const result = (cp.iterator as Iterator<Variable>).next()
  if (result.done) {
    query.stack.pop()
    doConst(query, term)
    return
  }

  doVar(cp, result)
}

function iConst(
  query: Query,
  term: Argument,
  advance: Operation,
  eConst: Operation,
): void {
  function doVar(cp: ChoicePoint, result: IteratorResult<Variable>) {
    const proxi = query.calling.get(result.value as Variable)
    if (!proxi) {
      query.calling.set(result.value, term as Term)
      cp.trail = result.value
      cp.side = Side.Callee
    } else if (proxi.termType !== 'Variable') {
      if (proxi !== term) {
        query.fail = true
        return
      }
    } else {
      const ulti = query.deref(proxi as Variable)
      if (ulti.termType === 'Variable') {
        query.scope.set(ulti as Variable, term as Term)
        cp.trail = ulti as Variable
        cp.side = Side.Caller
      } else if (ulti !== term) {
        query.fail = true
        return
      }
    }
    advance(query, result.value)
  }
  iTerm(query, term, eConst, doVar)
}

function iNewVar(
  query: Query,
  term: Argument,
  advance: Operation,
  eNewVar: Operation,
) {
  function doVar(cp: ChoicePoint, result: IteratorResult<Variable>) {
    let found = query.calling.get(result.value as Variable)
    if (!found) {
      query.calling.set(result.value, term as Term)
      cp.trail = result.value
      cp.side = Side.Callee
    } else {
      if (found.termType === 'Variable') found = query.deref(found as Variable)
      query.scope.set(term as Variable, found)
      cp.trail = term as Variable
      cp.side = Side.Caller
    }
    advance(query, result.value)
  }
  iTerm(query, term, eNewVar, doVar)
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
