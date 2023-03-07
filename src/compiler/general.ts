// this could eliminate some more signature matches that'll never
// return anything by tracking variable bindings across source
// patterns, but i'm not sure it's worth it. how much compilation
// can be done in the FP language itself? that could give us the
// backtracking necessary to do that elimination

// opt: don't alternate bottom-up and top-down segments, instead keep them
// contiguous for better caching.

// maybe it even makes sense to break from the WAM and store programs as
// trees, with nodes per expression or choice? that complicates the processor
// a little, but not by much - we just need an expression stack. it might comp-
// -licate the debugger UI a good deal, though. well, ig it could just be a tree
// view, with collapsable nodes. it'd also be super easy to work with program
// trees for now, and just flatten them into an array whenever i want to gain
// the speed, which might even be a negligible difference. except each choice
// will probs be less than a cache line - it's multiple choices per pattern -
// so with a single, straight array i can at least exploit some locality there
// it probably doesn't make that big of a diff either way, with a slight speed
// advantage to an array and some compiler simplifications with a tree, but the
// latter of these can be mitigated with good program design, and anyways have
// no effect on the average user.

import { Clause } from '../clause.js'
import { Index } from '../collections/index.js'
import { Module } from '../module.js'
import { operations as ops } from '../operations.js'
import {
  Argument,
  Instruction,
  Operation,
  Processor,
  Program,
} from '../processor.js'
import { traverse } from '../syntax.js'
import {
  ANON,
  Name,
  Quad,
  Term,
  Triple,
  TRIPLE_PLACES,
  Variable,
} from '../term.js'
import { getReifiedTriple, VarMap } from '../util.js'
import { bindingsToQuad, compile as compileMatcher } from './matching.js'

type Thunkable = [Operation, Argument, Argument | (() => Argument)]
type PreProgram = Thunkable[]

class Scope {
  callees: Callee[] = []
  vars: VarMap

  constructor(public module: Module, vars: Variable[] = []) {
    this.vars = new VarMap(vars)
  }

  buildPattern(data: Index, pat: Triple): Program {
    return [
      [ops.setIndex, data.data.get('SPO'), null],
      this.edbInstr('Medial', pat.subject),
      this.edbInstr('Medial', pat.predicate),
      this.edbInstr('Final', pat.object),
    ].filter(Boolean) as Program
  }

  edbInstr(position: string, term: Term): Instruction | null {
    const instr = (type: string, arg: Argument): Instruction => [
      ops['e' + position + type],
      arg,
      null,
    ]
    if (term === ANON) {
      if (position === 'Final') return null
      else return instr('AnonVar', null)
    }
    if (term instanceof Variable) {
      let type = 'OldVar'
      // opt: isNew should be scoped to this branch of
      // the disjunction if we know we're the first line
      let [idx, isNew] = this.vars.map(term)
      if (isNew) type = 'NewVar'
      return instr(type, idx)
    }
    return instr('Const', term)
  }

  getCallee(clause: Clause): [Callee, number] {
    let found = this.callees.find(clee => clee.target === clause)
    if (!found) found = new Callee(this, clause)
    return [found, this.callees.indexOf(found)]
  }
}

export class Callee {
  offset: number = -1 // rewritten in second pass

  constructor(public caller: Scope, public target: Clause) {
    this.caller.callees.push(this)
  }

  buildPattern(idx: number, erPat: Triple, eePat: Triple): PreProgram {
    const out: (Thunkable | null)[] = []

    // should we do scheduleCall after we match the pattern line? no need to
    // unwind it if the match fails. minor @opt maybe
    if (this.target.body) out.push([ops.scheduleCall, 2 ** idx, null])

    for (const place of TRIPLE_PLACES)
      out.push(this.idbInstr(erPat[place], eePat[place]))

    return out.filter(Boolean) as PreProgram
  }

  idbInstr(
    erArg: Argument,
    eeArg: Argument | (() => Argument),
  ): Thunkable | null {
    if (erArg === ANON || erArg === ANON) return null

    let erType = 'Const'
    let eeType = 'Const'

    if (erArg instanceof Variable) {
      const [idx, isNew] = this.caller.vars.map(erArg)
      erType = (isNew ? 'New' : 'Old') + 'Var'
      erArg = idx
    }

    if (eeArg instanceof Variable) {
      const eeIndex = this.target.vars.indexOf(eeArg as Variable)
      // thunking since we don't know our real offset yet; thunk called in
      // adjustCalleeOffsets()
      eeArg = () => eeIndex + this.offset
      eeType = 'Var'
    }

    // no need to check terms' equality, since the signature match
    // wouldn't return this result otherwise
    if (erType === 'Const' && eeType === 'Const') return null

    return [ops['i' + erType + eeType], erArg, eeArg]
  }
}

export function compile(
  module: Module,
  query: Name,
  vars: Variable[] = [],
  doMemos: boolean = false,
): [Program, Scope, number] {
  type Type = 'edb' | 'call' | 'memo'
  type Choice = [PreProgram, Type]

  const proc = new Processor()
  const scope = new Scope(module, vars)
  const out: PreProgram = []

  function adjustCalleeOffsets(): number {
    if (scope.callees.length === 0) return 0

    // compute callee offsets
    let offset = 0
    for (const c of scope.callees) {
      c.offset = offset
      offset += c.target.vars.length
    }

    // now that our callees know their offsets, we can adjust callee var args
    // to envP-relative values, by calling the thunk Callee.idbInstr() created
    // earlier
    for (let i = 0; i < out.length; i++) {
      const [op, left, right] = out[i]
      if (right instanceof Function) out[i] = [op, left, (right as Function)()]
    }

    return offset
  }

  // this should throw a compile error if there are no matches
  function doPattern(pattern: Name): void {
    const choices: Choice[] = []

    function addChoices(er: Triple, ee: Quad): void {
      const listener = { graph: query, ...er }
      const edb = module.modules.get(ee.graph)

      if (edb) {
        choices.push([scope.buildPattern(edb.facts, er), 'edb'])
        edb.listeners.add(listener)

      } else {
        const [callee, idx] = scope.getCallee(module.clauses.get(ee.graph)!)
        callee.target.listeners.add(listener)

        const call = callee.buildPattern(idx, er, ee)
        // > 1, because buildPattern() always produces a scheduleCall instr,
        // even if that's the only one (ie all three pattern terms are matching
        // consts)
        if (call.length > 1) choices.push([call, 'call'])

        if (doMemos && callee.target.memo)
          choices.push([scope.buildPattern(callee.target.memo, er), 'memo'])
      }
    }

    const caller = getReifiedTriple(module, pattern)

    proc.evaluate(
      compileMatcher(module, pattern),
      bindingsToQuad((callee: Quad) => addChoices(caller, callee)),
    )

    pushDisjunction(choices)
  }

  function pushDisjunction(choices: Choice[]): void {
    if (choices.length < 2) {
      if (choices.length > 0) out.push(...choices[0][0])
      return
    }

    const order: Type[] = ['edb', 'call', 'memo']
    choices.sort(([, a], [, b]) => order.indexOf(a) - order.indexOf(b))

    let startedCalls = false
    let startedMemos = false
    const start = out.length

    // todo: i think we can avoid this rewriting by pushing skip instructions
    // with the following Choice, not the preceeding as we do now
    let prevSkip: number

    for (let i = 0; i < choices.length; i++) {
      const [choice, type] = choices[i]

      // FIXME: is all this skipIfDirection stuff right? bc top-down will still
      // check memos, and bottom-up will still make calls. i should probs decide
      // on what the memo structure is before designing the instruction set for
      // it. and ideally it wouldn't be modal, either: in the process of setting
      // up the call, i'd also check the memo, and then at the end of that:
      // if no memo result
      //    if memo is complete: fail
      //    else: jump to body
      // else: return memo result
      if (doMemos) {
        if (!startedCalls && type === 'call') {
          startedCalls = true
          prevSkip = out.length
          out.push([ops.skipIfDirection, null, 'up'])
        } else if (!startedMemos && type === 'memo') {
          out[prevSkip!][1] = out.length
          startedMemos = true
          prevSkip = out.length
          out.push([ops.skipIfDirection, null, 'down'])
        }
      }

      out.push(
        [
          i === 0 ? ops.tryMeElse : ops.retryMeElse,
          // ie the number of instrs passed to this push() call
          out.length + choice.length + 2,
          null,
        ],
        ...choice,
        [ops.skip, null, null],
      )
    }

    if (startedMemos) out[prevSkip!][1] = out.length - 1
    out.push([ops.popCP, null, null])

    for (let i = start; i < out.length; i++) {
      const instr = out[i]
      if (instr[0] === ops.skip) instr[1] = out.length - 1
    }
  }

  traverse(module.facts, query, { doPattern })

  const envSize = adjustCalleeOffsets()
  if (scope.callees.length > 0) out.push([ops.doCalls, null, null])
  return [out as Program, scope, envSize]
}
