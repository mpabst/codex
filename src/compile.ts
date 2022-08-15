import { Clause } from './clause.js'
import { randomString, variable } from './data-factory.js'
import { operations } from './operations.js'
import { Program } from './query.js'
import { Context, Key, Store } from './store.js'
import { Expression, Pattern, traverse } from './syntax.js'
import { Term, Variable } from './term.js'

export function compile(
  store: Store,
  query: Expression | null,
): [Program, Map<Variable, Variable>] {
  // For bodiless rules
  if (!query) return [[[operations.emitResult, null]], new Map()]

  const program: Program = []
  const variables = new Map<Variable, Variable>()
  let lastContext: Context | null = null
  let mode: 'E' | 'I' = 'E' // EDB vs IDB

  function pattern(expr: Pattern): void {
    // assume GSPO
    const context = store.get(expr.terms[0] as Key)!

    if (lastContext && context !== lastContext)
      program.push([operations.call, null])

    if (context instanceof Clause) {
      mode = 'I'
      program.push([operations.setClause, context])
    } else {
      mode = 'E'
      program.push([operations.setIndex, context])
    }

    expr.terms.slice(1).forEach((term: Term | null, i) => {
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

      // minus 2 because we're in a slice(1)
      const position = i === expr.terms.length - 2 ? 'final' : 'medial'
      program.push([operations[position + mode + op], term])
    })

    lastContext = context
  }

  traverse(query, { pattern })

  if (lastContext! instanceof Clause) program.push([operations.call, null])
  program.push([operations.emitResult, null])

  return [program, variables]
}
