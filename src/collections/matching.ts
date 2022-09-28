import { VTMap, VTQuadSet } from '../collections/var-tracking.js'
import { Prefixers, variable } from '../data-factory.js'
import { Callable, Module } from '../module.js'
import { Branch } from '../operations.js'
import {
  Argument,
  Bindings,
  DBNode,
  InstructionSet,
  Processor,
} from '../processor.js'
import { Query } from '../query.js'
import { Name, Term, Variable } from '../term.js'
import { getReifiedTriple, VarMap } from '../util.js'

const { rdf } = Prefixers

export function compile(module: Module, name: Name): Query {
  const { root, order } = getSignature(module, name)
  if (order[0] !== 'graph')
    throw new Error('signature order must start with graph')
  const pattern = getReifiedTriple(module, name)
  const ops = operations()
  const vars = new VarMap()
  const out = new Query()
  out.program = [[ops.sChooseGraph, root, null]]
  for (const place of order.slice(1)) {
    const pos = place === order[order.length - 1] ? 'sMedial' : 'sFinal'
    const term = pattern[place]
    const push = (type: string, caller: Argument) =>
      out.program.push([ops[pos + type], caller, variable(place as string)])
    if (term instanceof Variable) {
      const [offset, isNew] = vars.map(term)
      push((isNew ? 'New' : 'Old') + 'Var', offset)
    } else push('Const', term)
  }
  out.program.push([ops.emitResult, null, null])
  out.vars = vars.vars
  return out
}

function getSignature(module: Module, pattern: Name): VTQuadSet {
  const po = module.facts.getRoot('SPO').get(pattern)
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
    if (!callable) throw new Error(`module ${module.name} can't find graph: ${graph}`)
  }
  return callable.signature
}

function match(dbNode: DBNode | null, term: Argument): Iterable<Term> {
  if (typeof term === 'number') return (dbNode as VTMap).keys()
  // todo: avoid traversing this in two passes (second one
  // via backtracking)? if varKeys is small then two passes
  // may be faster
  // todo: separate this into separate var and const methods
  // for when we can statically determine the class of term
  const out = [...(dbNode as VTMap).varKeys]
  if ((dbNode as VTMap).has(term as Term)) out.push(term as Term)
  return out
}

export function operations(): InstructionSet {
  let calleeVars = new VarMap()
  const result: Bindings = new Map()

  function mapVar(proc: Processor, v: Variable): number {
    const [offset, isNew] = calleeVars.map(v)
    if (isNew) {
      const addr = proc.calleeP + offset
      proc.heap[addr] = addr
    }
    return offset
  }

  function konst(
    proc: Processor,
    caller: Term,
    place: Variable,
  ): IteratorResult<Term> {
    const next = proc.nextChoice(() => match(proc.dbNode, caller))
    if (next.done) return next
    const { value } = next
    if (value instanceof Variable) {
      const found = proc.derefCallee(mapVar(proc, value))
      if (typeof found === 'number') proc.bind(found, caller)
      else if (caller !== found) {
        proc.fail = true
        return { value: null, done: true }
      }
    }
    result.set(place, value)
    return next
  }

  function newVar(
    proc: Processor,
    caller: number,
    place: Variable,
  ): IteratorResult<Term> {
    const next = proc.nextChoice(() =>
      match(proc.dbNode, proc.query?.vars[caller]!),
    )
    if (next.done) return next
    const { value } = next
    if (value instanceof Variable) {
      const found = proc.derefCallee(mapVar(proc, value))
      if (typeof found === 'number') proc.bind(found, caller)
      else proc.bindScope(caller, found)
    } else proc.bindScope(caller, value) // value is Const
    result.set(place, value)
    return next
  }

  function oldVar(
    proc: Processor,
    caller: number,
    place: Variable,
    position: 'Medial' | 'Final',
  ): void {
    const found = proc.derefScope(caller)
    const type = typeof found === 'number' ? 'NewVar' : 'Const'
    // found must be in caller's heap, and proc.scopeP === 0, so we can just
    // pass found as-is
    ops['s' + position + type](proc, found, place)
  }

  const ops: InstructionSet = {
    sChooseGraph(proc: Processor, root: Argument, _: Argument): void {
      proc.dbNode = root as Branch
      const { value, done } = proc.nextChoice()
      if (done) return
      result.set(variable('graph'), value)
      calleeVars.clear()
    },

    sMedialConst(proc: Processor, caller: Argument, place: Argument): void {
      const { done, value } = konst(proc, caller as Term, place as Variable)
      if (!done) proc.dbNode = (proc.dbNode as Branch).get(value) as DBNode
    },

    sMedialNewVar(proc: Processor, caller: Argument, place: Argument): void {
      const { value, done } = newVar(proc, caller as number, place as Variable)
      if (!done) proc.dbNode = (proc.dbNode as Branch).get(value) as DBNode
    },

    sMedialOldVar(proc: Processor, caller: Argument, place: Argument): void {
      oldVar(proc, caller as number, place as Variable, 'Medial')
    },

    sFinalConst(proc: Processor, caller: Argument, place: Argument): void {
      konst(proc, caller as Term, place as Variable)
    },

    sFinalNewVar(proc: Processor, query: Argument, place: Argument): void {
      newVar(proc, query as number, place as Variable)
    },

    sFinalOldVar(proc: Processor, caller: Argument, place: Argument): void {
      oldVar(proc, caller as number, place as Variable, 'Final')
    },

    emitResult(proc: Processor, _: Argument, __: Argument): void {
      proc.emit!(result)
      proc.fail = true
    },
  }

  return ops
}
