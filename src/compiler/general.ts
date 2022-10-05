// this could eliminate some more signature matches that'll never
// return anything by tracking variable bindings across source
// patterns, but i'm not sure it's worth it. how much compilation
// can be done in the FP language itself? that could give us the
// backtracking necessary to do that elimination

import { Clause } from '../clause.js'
import { Index } from '../collections/index.js'
import { Module } from '../module.js'
import { operations } from '../operations.js'
import {
  Argument,
  Instruction,
  Processor,
  Program,
} from '../processor.js'
import { traverse } from '../syntax.js'
import { ANON, Name, Quad, Term, Triple, Variable } from '../term.js'
import { getReifiedTriple, VarMap } from '../util.js'
import { bindingsToQuad, compile as compileMatcher } from './matching.js'

class Scope {
  callees: Callee[] = []
  vars: VarMap

  constructor(public module: Module, vars: Variable[] = []) {
    this.vars = new VarMap(vars)
  }

  buildPattern(data: Index, pat: Triple): Program {
    return [
      [operations.setIndex, data.getRoot('SPO'), null],
      this.edbInstr('Medial', pat.subject),
      this.edbInstr('Medial', pat.predicate),
      this.edbInstr('Final', pat.object),
    ].filter(Boolean) as Program
  }

  edbInstr(position: string, term: Term): Instruction | null {
    const instr = (type: string, arg: Argument): Instruction => [
      operations['e' + position + type],
      arg,
      null,
    ]
    if (term === ANON) {
      if (position === 'Final') return null
      else return instr('AnonVar', null)
    }
    if (term instanceof Variable) {
      let type = 'OldVar'
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

  buildPattern(idx: number, erPat: Triple, eePat: Triple): Program {
    return [
      [operations.setCallee, idx, this.target.body ? this : null],
      this.idbInstr(erPat.subject, eePat.subject),
      this.idbInstr(erPat.predicate, eePat.predicate),
      this.idbInstr(erPat.object, eePat.object),
    ].filter(Boolean) as Program
  }

  idbInstr(erArg: Argument, eeArg: Argument): Instruction | null {
    if (erArg === ANON || erArg === ANON) return null

    let erType = 'Const'
    let eeType = 'Const'

    if (erArg instanceof Variable) {
      let [idx, isNew] = this.caller.vars.map(erArg)
      if (isNew) erType = 'NewVar'
      else erType = 'OldVar'
      erArg = idx
    }

    if (eeArg instanceof Variable) {
      eeArg = this.target.vars.indexOf(eeArg)
      eeType = 'Var'
    }

    // no need to check terms' equality, since the signature match
    // wouldn't return this result otherwise
    if (erType === 'Const' && eeType === 'Const') return null

    return [operations['i' + erType + eeType], erArg, eeArg]
  }
}

export function compile(
  module: Module,
  query: Name,
  vars: Variable[] = [],
): [Program, Scope, number] {
  const ground: Program[][] = []
  const calls: Program[][] = []
  const memos: Program[][] = []
  const proc = new Processor()
  const scope = new Scope(module, vars)
  const out: Program = []

  function adjustCallees(): number {
    if (scope.callees.length === 0) return 0

    // compute callee offsets
    let offset = 0
    for (const c of scope.callees) {
      c.offset = offset
      offset += c.target.vars.length
    }
    // adjust setCallee offset args to their correct values
    for (let i = 0; i < out.length; i++) {
      const [op, left, right] = out[i]
      if (op === operations.setCallee)
        out[i] = [op, scope.callees[left as number].offset, right]
    }
    out.push([operations.doCalls, null, null])

    return offset
  }

  // this should throw an error if there are no matches
  function doPattern(pattern: Name): void {
    const gChoices: Program[] = []
    const cChoices: Program[] = []
    const mChoices: Program[] = []

    function addChoice(er: Triple, ee: Quad): void {
      const edb = module.modules.get(ee.graph)
      if (edb) gChoices.push(scope.buildPattern(edb.facts, er))
      else {
        const [callee, idx] = scope.getCallee(module.clauses.get(ee.graph)!)
        const call = callee.buildPattern(idx, er, ee)
        if (call.length > 1) cChoices.push(call)
        if (callee.target.memo)
          mChoices.push(scope.buildPattern(callee.target.memo, er))
      }
    }

    const caller = getReifiedTriple(module, pattern)

    proc.evaluate(
      compileMatcher(module, pattern),
      bindingsToQuad((callee: Quad) => addChoice(caller, callee))
    )

    ground.push(gChoices)
    calls.push(cChoices)
    memos.push(mChoices)
  }

  function pushDisjunction(choices: Program[]): void {
    if (choices.length === 1) {
      out.push(...choices[0])
      return
    }
    const start = out.length
    const next = (choice: Program) => out.length + choice.length + 2
    out.push([operations.tryMeElse, next(choices[0]), null], ...choices[0], [
      operations.skip,
      null,
      null,
    ])
    for (let i = 1; i < choices.length - 1; i++)
      out.push(
        [operations.retryMeElse, next(choices[i]), null],
        ...choices[i],
        [operations.skip, null, null],
      )
    out.push(
      [operations.trustMe, null, null],
      ...choices[choices.length - 1],
    )
    // rewrite all skip args
    for (let i = start; i < out.length; i++) {
      const instr = out[i]
      // -1 because the processor increments programP after we set its value
      if (instr[0] === operations.skip) instr[1] = out.length - 1
    }
  }

  traverse(module.facts, query, { doPattern })

  for (const g of ground) pushDisjunction(g)
  let prevSkip = out.length
  out.push([operations.skipIfDirection, null, 'up'])
  for (const c of calls) pushDisjunction(c)
  out[prevSkip][1] = out.length - 1
  prevSkip = out.length
  out.push([operations.skipIfDirection, null, 'down'])
  for (const m of memos) pushDisjunction(m)
  out[prevSkip][1] = out.length - 1

  const envSize = adjustCallees()
  return [out, scope, envSize]
}
