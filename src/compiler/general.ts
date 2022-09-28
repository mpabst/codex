// this could eliminate some more signature matches that'll never
// return anything by tracking variable bindings across source
// patterns, but i'm not sure it's worth it. how much compilation
// can be done in the FP language itself? that could give us the
// backtracking necessary to do that elimination

import { Clause } from '../clause.js'
import { Module } from '../module.js'
import { operations } from '../operations.js'
import { Argument, Instruction, Processor, Program } from '../processor.js'
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

  compile(er: Triple, ee: Quad, offset: number, numChoices: number): Program {
    let instrs: Program
    const edb = this.module.modules.get(ee.graph)
    if (edb) {
      instrs = [
        [operations.setIndex, edb.facts.getRoot('SPO'), null],
        this.edbInstr('Medial', er.subject),
        this.edbInstr('Medial', er.predicate),
        this.edbInstr('Final', er.object),
      ].filter(Boolean) as Program
    } else {
      const [callee, idx] = this.getCallee(this.module.clauses.get(ee.graph)!)
      instrs = [
        [operations.setCallee, idx, null],
        callee.idbInstr(er.subject, ee.subject),
        callee.idbInstr(er.predicate, ee.predicate),
        callee.idbInstr(er.object, ee.object),
      ].filter(Boolean) as Program
      // all anons or const-consts
      if (instrs.length === 1) return []
    }
    return [
      [
        numChoices === 0 ? operations.try : operations.retry,
        offset + instrs!.length + 1,
        null,
      ],
      ...instrs!,
    ]
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

class Callee {
  offset: number = -1 // rewritten in second pass

  constructor(public caller: Scope, public target: Clause) {
    this.caller.callees.push(this)
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
  vars: Variable[] = []
): [Program, Variable[], number] {
  const prog: Program = []
  const proc = new Processor()
  const scope = new Scope(module, vars)

  function doPattern(pattern: Name): void {
    let current: Program = []
    let numChoices = 0

    proc.evaluate(
      compileMatcher(module, pattern),
      bindingsToQuad((callee: Quad) => {
        current.push(
          ...scope.compile(
            getReifiedTriple(module, pattern),
            callee,
            prog.length + current.length,
            numChoices,
          ),
        )
        numChoices++
      }),
    )

    // chop off initial try if we only have one choice
    if (numChoices === 1) current = current.slice(1)
    // rewrite final retry to trust
    else
      for (let i = current.length - 1; i > -1; i--) {
        const instr = current[i]
        if (instr[0] === operations.retry) {
          instr[0] = operations.trust
          break
        }
      }

    prog.push(...current)
  }

  traverse(module.facts, query, { doPattern })

  let offset = 0
  for (const c of scope.callees) {
    c.offset = offset
    offset += c.target.vars.length
  }
  return [
    prog.map(([op, left, right]) =>
      op === operations.setCallee
        ? [op, scope.callees[left as number].offset, null]
        : [op, left, right],
    ),
    scope.vars.vars,
    offset,
  ]
}
