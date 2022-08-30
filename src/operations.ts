import { Clause } from './clause.js'
import { Index } from './collections/index.js'
import { VTMap } from './collections/var-tracking.js'
import { Argument, Bindings, ChoicePoint, Operation, Query } from './query.js'
import { VarMap } from './syntax.js'
import { Term, Variable } from './term.js'

// instead of dynamically branching through the heads,
// we can just do those same queries at compile time,
// and in the emitter, generate ops covering the
// combination of caller and callee terms, not just
// the former, with a bunch of branching to determine
// the latter

export type Leaf = Set<Term> | Map<Term, number>
export type Branch = Map<Term, Leaf> | Map<Term, Map<Term, Leaf>>

function advanceMedial(query: Query, term: Argument): void {
  query.dbNode = (query.dbNode as Branch).get(term as Term)!
  query.programP++
}

function advanceFinal(query: Query, _: Argument): void {
  query.programP++
}

function eAnonVar(query: Query, advance: Operation): void {
  const { done, value } = query.nextChoice()
  if (!done) advance(query, value)
}

function eNewVar(query: Query, term: Argument, advance: Operation): void {
  const { done, value } = query.nextChoice()
  if (!done) {
    query.bindScope(term as Variable, value)
    advance(query, value)
  }
}

function iConst(
  query: Query,
  caller: Argument,
  advance: Operation,
  eConst: Operation,
): void {
  const vars = (query.dbNode as VTMap).varKeys

  if (vars.size === 0) {
    eConst(query, caller)
    return
  }

  const cp = query.getOrPushCP(vars) as ChoicePoint<Variable>
  if (!cp.constDone) {
    eConst(query, caller)
    cp.constDone = true
    return
  }

  const { done, value: callee } = cp.next()
  if (done) return

  const proximate = query.callee.get(callee as Variable)

  if (!proximate) query.bindCallee(callee, caller as Term)
  else if (proximate.termType !== 'Variable') {
    if (proximate !== caller) {
      query.fail = true
      return
    }
  } else {
    const ultimate = query.deref(proximate as Variable)
    if (ultimate.termType === 'Variable')
      query.bindScope(ultimate as Variable, caller as Term)
    else if (ultimate !== caller) {
      query.fail = true
      return
    }
  }

  advance(query, callee)
}

function iNewVar(query: Query, caller: Argument, advance: Operation): void {
  const { done, value: callee } = query.nextChoice()
  if (done) return

  if (callee.termType === 'Variable') {
    let found = query.callee.get(callee as Variable)!
    if (found === callee)
      query.bindCallee(callee as Variable, caller as Variable)
    else {
      if (found.termType === 'Variable') found = query.deref(found as Variable)
      query.bindScope(caller as Variable, found as Variable)
    }
  } else query.bindScope(caller as Variable, callee)

  advance(query, callee)
}

function iOldVar(
  query: Query,
  term: Argument,
  advance: Operation,
  eConst: Operation,
): void {
  const found = query.deref(term as Variable)
  if (found.termType === 'Variable') iNewVar(query, found, advance)
  else iConst(query, found, advance, eConst)
}

export const operations: { [k: string]: Operation } = {
  // have setClause set pending, and follow it with a setIndex
  setClause(query: Query, clause: Argument): void {
    query.pending = [clause as Clause, (clause as Clause).body.newScope(null)]
    query.dbNode = (clause as Clause).signature.getRoot('SPO')
    query.programP++
  },

  setIndex(query: Query, index: Argument): void {
    query.dbNode = (index as Index).getRoot('SPO')
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
    iNewVar(query, term, advanceMedial)
  },

  medialIOldVar(query: Query, term: Argument): void {
    iOldVar(query, term, advanceMedial, operations.medialEConst)
  },

  finalEConst(query: Query, term: Argument): void {
    if ((query.dbNode as Leaf).has(term as Term)) query.programP++
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
    iNewVar(query, term, advanceFinal)
  },

  finalIOldVar(query: Query, term: Argument): void {
    iOldVar(query, term, advanceFinal, operations.finalEConst)
  },

  call(query: Query, _: Argument): void {
    // if seen advance
    // else copy args, call, set dbNode, jump to pending[2]

    let cp: ChoicePoint<Bindings>
    if (query.stackP > -1) cp = query.stack[query.stackP]

    if (!cp!?.isCurrent(query)) {
      const [clause, args] = query.pending!
      const inArgs: Bindings = new Map()
      const outArgs: VarMap = new Map()

      // i don't think i'm handling the case where a caller
      // binds two callee vars to each other (ie by binding
      // them both to a common caller var)

      for (const [k, v] of args)
        if (v.termType === 'Variable' && v !== k) outArgs.set(k, v as Variable)
        else inArgs.set(k, v)
      cp = new ChoicePoint(query, clause.pull(inArgs), outArgs)
      query.pushCP(cp)
    }

    const { value, done } = cp.next()
    if (done) return

    for (const [k, v] of cp.outArgs!) query.bindScope(v, value.get(k))
    query.programP++
  },

  emitResult(query: Query, _: Argument): void {
    query.emit!(query.scope!)
    query.fail = !query.backtrack()
  },
}
