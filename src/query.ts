// this could eliminate some more signature matches that'll never
// return anything by tracking variable bindings across source
// patterns, but i'm not sure it's worth it. how much compilation
// can be done in the FP language itself? that could give us the
// backtracking necessary to do that elimination

import { Clause } from './clause.js'
import { Prefixers, variable } from './data-factory.js'
import { Argument, Instruction, Program } from './processor.js'
import { Callable, Module } from './module.js'
import { operations } from './operations.js'
import { traverse } from './syntax.js'
import { ANON, Name, Quad, Term, Variable } from './term.js'
import { VarMap } from './var-map.js'

const { rdf } = Prefixers

export class Scope {
  callees: Callee[] = []
  vars = new VarMap()

  constructor(public module: Module) {}

  compile(er: Quad, ee: Quad, offset: number, numChoices: number): Program {
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
  // rewritten in second pass
  offset: number = -1

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

function compile(module: Module, expression: Name): [Program, Variable[]] {
  const program: Program = []
  const scope = new Scope(module)

  function pattern(node: Name): void {
    const po = module.facts.getRoot('SPO').get(node)
    const graphs = po.get(rdf('graph'))
    let callable: Callable | undefined
    if (!graphs) callable = module
    else {
      // todo: allow multiple graphs on a Pattern?
      const graph = [...graphs][0]
      if (graph instanceof Variable)
        throw new Error('todo: variable graph terms')
      // todo: what if a rule and a module are defined at the same name?
      callable = module.modules.get(graph) ?? module.rules.get(graph)
      if (!callable) throw new Error(`graph not found: ${node}`)
    }

    const [subject] = po.get(rdf('subject'))
    const [predicate] = po.get(rdf('predicate'))
    const [object] = po.get(rdf('object'))

    let current: Program = []
    let numChoices = 0

    const caller = { graph: variable('_'), subject, predicate, object }
    callable.signature.match(caller, (callee: Quad) => {
      current.push(
        ...scope.compile(
          caller,
          callee,
          program.length + current.length,
          numChoices,
        ),
      )
      numChoices++
    })

    // chop off initial try if we only have one choice
    if (numChoices === 1) current = current.slice(1)
    else
      // rewrite final retry to trust
      for (let i = current.length - 1; i > -1; i--) {
        const instr = current[i]
        if (instr[0] === operations.retry) {
          instr[0] = operations.trust
          break
        }
      }

    program.push(...current)
  }

  traverse(module.facts, expression, { pattern })

  let offset = 0
  for (const c of scope.callees) {
    c.offset = offset
    offset += c.target.vars.length
  }
  return [
    program.map(([op, left, right]) =>
      op === operations.setCallee
        ? [operations.setCallee, scope.callees[left as number].offset, null]
        : [op, left, right],
    ),
    scope.vars.vars,
  ]
}

export class Query {
  program: Program
  vars: Variable[]
  // size: number // size of activation record, ie all callee vars

  constructor(module?: Module, name?: Name) {
    if (module && name) {
      const [program, vars] = compile(module, name)
      this.program = program
      this.vars = vars
    } else {
      this.program = []
      this.vars = []
    }
  }
}
