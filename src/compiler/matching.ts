import { CurlyDataSet } from '../collections/data-set.js'
import { VTQuadSet, VTSet } from '../collections/var-tracking.js'
import { Prefixers, variable } from '../data-factory.js'
import { Callable, Module } from '../module.js'
import { Branch } from '../operations.js'
import { Argument, Bindings, InstructionSet, Processor, Program } from '../processor.js'
import { Matcher, Query } from '../query.js'
import { ANON, DEFAULT_GRAPH, Name, Quad, Term, Variable } from '../term.js'
import { getReifiedTriple, VarMap } from '../util.js'

const { rdf } = Prefixers

export const bindingsToQuad = (cb: (q: Quad) => void) => (b: Bindings) => {
  const out: Partial<Quad> = {}
  for (const [k, v] of b) out[k.value as keyof Quad] = v
  cb(out as Quad)
}

// make this an instance function on Matcher (extends Query);
// rn the superclass will call general.ts#compile(), but the
// subclass expects someone else to provide a compiled prog
//
// when i do that, separate this into two parts: one which finds
// the signature and reified pattern, and another which accepts
// a plain Triple
export function compile(module: Module, name: Name): Query {
  const sig = getSignature(module, name)
  const { order } = sig

  if (order[0] !== 'graph')
    throw new Error('signature order must start with graph')

  const pattern = getReifiedTriple(module, name)
  const ops = operations()
  const vars = new VarMap()
  // why am i choosing the graph first? why not SPOG?
  const program: Program = [[ops.sChooseGraph, sig, null]]

  for (const place of order.slice(1)) {
    const pos = place === order[order.length - 1] ? 'sFinal' : 'sMedial'
    const term = pattern[place]
    const push = (type: string, caller: Argument) =>
      program.push([ops[pos + type], caller, variable(place as string)])

    if (term instanceof Variable) {
      if (term === ANON) push('AnonVar', null)
      else {
        const [offset, isNew] = vars.map(term)
        push((isNew ? 'New' : 'Old') + 'Var', offset)
      }
    } else push('Const', term)
  }

  program.push([ops.emitResult, null, null])
  return new Matcher(program, vars.vars)
}

// looks for pattern in module, and maps its graph term to some
// signature object
function getSignature(module: Module, pattern: Name): VTQuadSet {
  const po = module.facts.getRoot('SPO').get(pattern)
  const graphs = po.get(rdf('graph'))
  let callable: Callable | undefined
  if (graphs) {
    // todo: allow multiple graphs on an fpc:Pattern?
    const [graph] = graphs

    if (graph === DEFAULT_GRAPH) callable = module
    else if (graph instanceof Variable)
      throw new Error('todo: variable graph terms')
    // todo: what if a rule and a module are defined at the same name?
    else callable = module.modules.get(graph) ?? module.rules.get(graph)

    if (!callable)
      throw new Error(`module ${module.name} can't find graph: ${graph}`)
  } else callable = module
  return callable.signature
}

function match(dbNode: VTSet, term: Term): Iterable<Term> {
  if (typeof term === 'number') return dbNode.keys()
  // todo: avoid traversing this in two passes (second one
  // via backtracking)? if varKeys is small then two passes
  // may be faster
  // todo: separate this into separate var and const methods
  // for when we can statically determine the class of term
  const out = [...dbNode.varKeys]
  if (dbNode.has(term) && !dbNode.varKeys.has(term)) out.push(term)
  return out
}

function operations(): InstructionSet {
  let calleeVars = new VarMap()

  // todo: use Processor.triple
  const result: Bindings = new Map()

  // todo: possible to do this statically? maybe put a Variable[] on
  // the signature or whatever I'm matching against?
  function mapVar(proc: Processor, v: Variable): number {
    const [offset, isNew] = calleeVars.map(v)
    if (isNew) {
      const addr = proc.calleeP + offset
      proc.heap[addr] = addr
    }
    return offset
  }

  function advance(
    proc: Processor,
    { done, value }: IteratorResult<Term>,
  ): void {
    if (!done) proc.dbNode = (proc.dbNode as Branch).get(value)!
  }

  function anonVar(proc: Processor, place: Variable): IteratorResult<Term> {
    const next = proc.nextChoice()
    if (next.done) return next
    result.set(place, next.value)
    return next
  }

  function konst(
    proc: Processor,
    caller: Term,
    place: Variable,
  ): IteratorResult<Term> {
    const next = proc.nextChoice(() => match(proc.dbNode as VTSet, caller))
    if (next.done) return next
    const { value } = next
    if (value instanceof Variable)
      if (value !== ANON) {
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
      match(proc.dbNode as VTSet, proc.query?.scope[caller]!),
    )
    if (next.done) return next
    const { value } = next
    if (value instanceof Variable) {
      if (value !== ANON) {
        const found = proc.derefCallee(mapVar(proc, value))
        if (typeof found === 'number') proc.bind(found, caller)
        else proc.bindScope(caller, found)
      }
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
    sChooseGraph(proc: Processor, data: Argument, _: Argument): void {
      proc.dbNode = (data as CurlyDataSet).root
      const { value, done } = proc.nextChoice()
      if (done) return
      proc.dbNode = proc.dbNode.get(value) as Branch
      result.set(variable('graph'), value)
      calleeVars.clear()
      // this last line only needs to be run once per matching query:
      // call it sAllocate ?
      proc.calleeP = proc.envP
    },

    sMedialAnonVar(proc: Processor, _: Argument, place: Argument): void {
      advance(proc, anonVar(proc, place as Variable))
    },

    sMedialConst(proc: Processor, caller: Argument, place: Argument): void {
      advance(proc, konst(proc, caller as Term, place as Variable))
    },

    sMedialNewVar(proc: Processor, caller: Argument, place: Argument): void {
      advance(proc, newVar(proc, caller as number, place as Variable))
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
