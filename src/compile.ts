import { Clause } from './clause.js'
import { randomString, variable } from './data-factory.js'
import { operations } from './operations.js'
import { Program } from './query.js'
import { Context, Key, Store } from './store.js'
import { Expression, Pattern, traverse } from './syntax.js'
import { Quad, Term, Variable } from './term.js'

// there are two and a half sorts of queries:
// - 'regular queries', including clause bodies
//   - searching EDBs and making calls
//   - searching memos
//     - jump back up to first statement in call
//     - if call statements are all continguous, can remove all but first setClause
//     - choice points, setting dbNode...? i think we just set dbNode and jump
// - diff triples searching bodies
//   - same instructions, except a replacement for setClause
//   - what abt variable graph terms? how to restrict? the first thing
//     to come to mind is to restrict it by what's already been bound -
//     it's an in-var only, so it has to have had associated values.
//     what if that set of values changes during push eval?
//     how about - if bind to var graph, set aside. check other diff stmts first.
//     if it's still unchecked afterwards, see if graph is in already fetched set. if yes, check, if not, discard

export function compile(
  store: Store,
  query: Expression<Quad> | null,
): [Program, Map<Variable, Variable>] {
  // For bodiless rules
  if (!query) return [[[operations.emitResult, null]], new Map()]

  const program: Program = []
  const variables = new Map<Variable, Variable>()
  let lastContext: Context | null = null
  let mode: 'E' | 'I' = 'E' // EDB vs IDB

  function pattern({
    terms: { graph, subject, predicate, object },
  }: Pattern<Quad>): void {
    const context = store.get(graph as Key)!

    if (lastContext && context !== lastContext)
      program.push([operations.call, null])

    if (context instanceof Clause) {
      mode = 'I'
      // since all exprs for a call are contiguous, we only need one of these
      // per call
      program.push([operations.setClause, context])
    } else {
      mode = 'E'
      program.push([operations.setIndex, context])
    }

    // assume SPO order
    ;[subject, predicate, object].forEach((term: Term | null, i) => {
      let op: string
      if (term!.termType === 'Variable') {
        if (term!.value === '_') {
          op = 'AnonVar'
          term = null
        } else {
          let mapped = variables.get(term as Variable)
          if (mapped) op = 'OldVar'
          else {
            op = 'NewVar'
            mapped = variable(randomString())
            variables.set(term as Variable, mapped)
          }
          term = mapped
        }
      } else op = 'Const'
      const position = i === 2 ? 'final' : 'medial'
      program.push([operations[position + mode + op], term])
    })

    lastContext = context
  }

  traverse(query, { pattern })

  if (lastContext! instanceof Clause) program.push([operations.call, null])
  program.push([operations.emitResult, null])

  return [program, variables]
}
