import { Clause } from './clause.js'
import { Branch, Index, Twig } from './collections/index.js'
import { VTMap } from './collections/var-tracking.js'
import { Argument, Bindings, ChoicePoint, Operation, Query } from './query.js'
import { VarMap } from './syntax.js'
import { Term, Variable } from './term.js'

// call:
// 1. copy list of keys bound to unbound caller var -
// 2. do call, collect these out-args as caller var -> value
// 3. push choicepoint, iterate
// 4. at end of CP, unbind keys from 1, backtrack

// instead of dynamically branching through the heads,
// we can just do those same queries at compile time,
// and in the emitter, generate ops covering the
// combination of caller and callee terms, not just
// the former, with a bunch of branching to determine
// the latter

function advanceMedial(query: Query, term: Argument): void {
  query.dbNode = (query.dbNode as Branch).get(term as Term)!
  query.programP++
}

function advanceFinal(query: Query, _: Argument): void {
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
  const vars = (query.dbNode as VTMap).varKeys

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
  const proxi = query.pending![1].get(callee as Variable)
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
  let found = query.pending![1].get(callee as Variable)!
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
  eConst: Operation,
  eNewVar: Operation,
): void {
  const found = query.deref(term as Variable)
  if (found.termType === 'Variable') iNewVar(query, found, advance, eNewVar)
  else iConst(query, found, advance, eConst)
}

class ResultIterator implements Iterator<Bindings> {
  source: Iterator<Bindings>

  constructor(public outArgs: VarMap, source: Iterable<Bindings>) {
    this.source = source[Symbol.iterator]()
  }

  // remove this, put outVars on CP?
  next(): IteratorResult<Bindings> {
    return this.source.next()
  }
}

export const operations: { [k: string]: Operation } = {
  setClause(query: Query, clause: Argument): void {
    query.pending = [clause as Clause, (clause as Clause).body.newScope()]
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

  medialEAnonVar(query: Query, _: Argument): void {
    eAnonVar(query, advanceMedial)
  },

  medialIConst(query: Query, term: Argument): void {
    iConst(query, term, advanceMedial, operations.medialEConst)
  },

  medialINewVar(query: Query, term: Argument): void {
    iNewVar(query, term, advanceMedial, operations.medialENewVar)
  },

  medialIOldVar(query: Query, term: Argument): void {
    iOldVar(
      query,
      term,
      advanceMedial,
      operations.medialEConst,
      operations.medialENewVar,
    )
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

  finalIConst(query: Query, term: Argument): void {
    iConst(query, term, advanceFinal, operations.finalEConst)
  },

  finalINewVar(query: Query, term: Argument): void {
    iNewVar(query, term, advanceFinal, operations.finalENewVar)
  },

  finalIOldVar(query: Query, term: Argument): void {
    iOldVar(
      query,
      term,
      advanceFinal,
      operations.finalEConst,
      operations.finalENewVar,
    )
  },

  call(query: Query, _: Argument): void {
    let cp: ChoicePoint<Bindings>
    if (query.stackP > -1) cp = query.stack[query.stackP]

    if (!cp! || cp.programP !== query.programP) {
      const [clause, args] = query.pending!
      const inArgs: Bindings = new Map()
      const outArgs: VarMap = new Map()
      for (const [k, v] of args)
        if (v.termType === 'Variable' && v !== k) outArgs.set(v as Variable, k)
        else inArgs.set(k, v)
      cp = query.pushCP(new ResultIterator(outArgs, clause.call(inArgs)))
    }

    const { value, done } = cp.next()
    if (done) {
      query.fail = true
      return
    }

    for (const [k, v] of (cp.iterator as ResultIterator).outArgs)
      query.bindScope(v, value.get(k))
    query.programP++
  },

  emitResult(query: Query, _: Argument): void {
    query.emit!(new Map(query.scope))
    query.fail = !query.backtrack()
  },
}
