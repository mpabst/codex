import { VTMap, VTSet } from '../collections/var-tracking.js'
import { variable } from '../data-factory.js'
import { Branch } from '../operations.js'
import {
  Argument,
  Bindings,
  DBNode,
  Operation,
  Processor,
} from '../processor.js'
import { Quad, Term, Variable } from '../term.js'

function deref(proc: Processor, arg: Argument): Term | number {
  if (typeof arg === 'number') return proc.derefScope(arg)
  return arg as Term
}

function match(dbNode: DBNode | null, term: Argument): Iterable<Term> {
  if (typeof term === 'number') return (dbNode as VTMap).keys()
  // todo: avoid traversing this in two passes (second one
  // via backtracking)? if varKeys is small then two passes
  // may be faster
  // todo: separate this into separate var and const methods
  // for when we can statically determine the class of t
  const out = [...(dbNode as VTMap).varKeys]
  if ((dbNode as VTMap).has(term as Term)) out.push(term as Term)
  return out
}

export function operations(order: (keyof Quad)[]): { [k: string]: Operation } {
  const bindings = new Map<Variable, Term | number>()
  const result: Term[] = []

  function bind(value: Argument): void {

  }

  function emitResult(proc: Processor, _: Argument, __: Argument): void {
    const out: Bindings = new Map()
    for (const i in order) out.set(variable(order[i] as string), result[i])
    proc.emit!(out)
  }

  return {
    // this is identical to eMedialNewVar() minus the argument to nextChoice()
    sMedialNewVar(proc: Processor, query: Argument, _: Argument): void {
      const { value, done } = proc.nextChoice(() =>
        match(proc.dbNode, proc.query?.vars[query as number]!),
      )
      if (!done) {
        // set up binding; case with value inst Var and const
        result.push(value)
        proc.dbNode = (proc.dbNode as Branch).get(value) as DBNode
      }
    },

    sMedialOldVar(proc: Processor, query: Argument, _: Argument): void {
      const found = proc.derefScope(query as number)
      if (typeof found === 'number') this.sMedialNewVar(proc, found, null)
      else this.sMedialConst(proc, found, null)
    },

    sMedialConst(proc: Processor, query: Argument, _: Argument): void {
      const { value, done } = proc.nextChoice(() => match(proc.dbNode, query))
      if (!done) {
        // if (value instanceof Variable)...
        result.push(value)
        proc.dbNode = (proc.dbNode as Branch).get(value) as any
      }
    },

    sFinalNewVar(proc: Processor, query: Argument, _: Argument): void {
      const { value, done } = proc.nextChoice(() =>
        match(proc.dbNode as VTSet, proc.query?.vars[query as number] as Term),
      )
      if (!done) {
        // will never be a variable (for signature matching)
        proc.bindScope(query as number, value)
        result.push(value)
      }
    },

    // sFinalOldVar(proc: Processor, query: Argument, _: Argument): void {},

    // sFinalConst(proc: Processor, query: Argument, _: Argument): void {
    //   if ((proc.dbNode as VTSet).varKeys.size > 0) {
    //     const { value, done } = proc.nextChoice(() =>
    //       match(proc.dbNode as VTSet, query as Term),
    //     )
    //     if (!done) bind(value)
    //   } else if ((proc.dbNode as VTSet).has(query as Term)) bind(place, query)
    //   else proc.fail = true
    // },
  }
}
