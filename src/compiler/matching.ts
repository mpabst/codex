// This is the first instance of a custom data structure supported by custom
// opcodes+compiler, but run on the same underlying machine. Basically we can
// implement traversal and backtracking for pretty much any more specific data
// structure.

// In line with that, ig these indexes - source annotations, really - maybe more
// 'derived data we want to associate with its source' - should be expressed as
// a module with rules that consume rule head sources and return references to
// these more efficient data structures, and other rules for extracting data from
// these structures. Compiling queries against this module automatically invokes
// the module's own, customized compiler. Give library graphs a fpc:compiler prop
// lmao

// If certain forms of traversal aren't implemented, can we forbid them via the
// type system? I mean, so long as... there's some pattern in the source we can
// express and query for. Seems, uh, likely.

// Type checking as a special case of linters? Have it consume source directly.

// ig the answer to the query pattern forbidding question, definitely with a
// linter if not with shapes per se. Mandatory linter rules? Is that just a
// type? Because a type isn't just a constraint on the shape of data, it's
// also a constraint on expressions (which are data). Parsers as typecheckers?

// What about incremental updates? That can be custom, too, so long as the
// module speaks RDF with its peers. Interesting to see how this would work
// out with a few examples.

// It'd also be interesting to see how the compiler can be modularized, and
// extending it made as simple as possible

// Let's say you want more efficient rdf:Lists: you can import a module which
// alters your own compilation rules to work with a more efficient data
// structure, so it's not bound directly to the semantic type. You just have to
// respect the interface implied by rdf:List. Though ig you could fuck it up and
// your own importers just could no longer build against you, and we spot it
// with the typechecker. Not sure if we want to allow that?

// ig the problem is that some far-transitive caller might get a reference to
// you, so we need to use virtual dispatch. Ig that's the cost of variable graph
// terms: we can't do static binding. Maybe we can special case something where
// a graph term can be bound to an import arg, so we can preemptively do some
// linking there.

// When do people use virtual methods in C++? And all methods are virtual in Java

// Also like, our compiler is really simple. It just relates terms, arranged
// essentially in a grid, more or less 1-1 to instructions. The main optimi-
// -zation is reordering, and then not arbitrarially, but only within specific
// units corresponding to lines, expressions, etc.

// Maybe even in an imperative language, it'd be easier to express my compiler
// in a more relational way? It already is kinda relational, except with a bunch
// of maps and filters I use a bunch of if statements. What about using an Index?
// Sorta like a state machine. Every new term or pattern is a state transition,
// and we push instructions into some context object corresponding to a pattern
// or an expression - per expression type compilation handled here? - it's
// probably best to handle most optimization in a source preprocessor, so i can
// just flush directly to the program, minus maybe pattern reordering, because
// it's so simple and basic and i want to get it done soon because of that.

// Actually have compiler classes (rules eventually?) for a Pattern and a
// Conjunction. They consume their respective source nodes. They could just
// be functions that take a flush() cb too. Or return a value.

// Modules could also expose custom optimizers, that take large chunks of source
// and either return the rearrangements or hand it off to the module's compiler
// The regular compiler just accepts a pattern at a time.

// Ig it needs a variable scope, too. It could hand back a translation table, or
// just keep the vars in place, and they're sub'd in only in final assembly.
// Well, if it's all local, might as well pass a ref to the var table. I don't
// think it's worth it over the network, but maybe not.

// Actually pattern reordering is dependent on line ordering, because we need to
// know which vars are bound... though can we always know? Yes, so long as every
// option for a given pattern is contiguous in the compiled program. I think
// that's doable, so the pattern compiler can take the var table as an arg.

// We can still do it all in one pass if whatever it is we flush our expressions
// to maintains some state to add its own instructions. We'd need to be able to
// pass some kind of EOL signal. An object with two methods? One member, the out
// Program array. This could be packaged inside whatever Pattern/Conj class.
// ctor takes the module context, syntax node, the out stream, var table.
// abstract class Compiler

// it might be better as functions? We don't really need to tear down a struct
// for every pattern, seeing as how three of those four ctor refs will always
// be the same. A closure makes a lot of sense, especially if it all winds up
// stack allocated. If a compiler could do lifetime analysis and move some
// ctor'd data to the stack that'd be nifty, but I'm not sure anyone does?

// How do JS closures work? just checked: "probably heap, maybe stack if someone
// bothers to the the lifetime analysis" lol. I can just have a CompilerContext
// object or whatever to let me copy one pointer instead of three.

import { CurlyDataSet } from '../collections/data-set.js'
import { VTQuadSet, VTSet } from '../collections/var-tracking.js'
import { Prefixers, variable } from '../data-factory.js'
import { Callable, Module } from '../module.js'
import { Branch } from '../operations.js'
import {
  Argument,
  Bindings,
  InstructionSet,
  Processor,
  Program,
} from '../processor.js'
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
  if (dbNode.has(term) && !dbNode.varKeys.has(term as Variable))
    out.push(term as Variable)
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
