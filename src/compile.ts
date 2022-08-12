import { Clause } from './clause.js'
import { randomString, variable } from './data-factory.js'
import { operations, Program } from './query.js'
import { Context, Key, Store } from './store.js'
import { Expression, Pattern, traverse } from './syntax.js'
import { Term, Variable } from './term.js'

export function compile(
  store: Store,
  query: Expression,
): [Program, Map<Variable, Variable>] {
  const program: Program = []
  const variables = new Map<Variable, Variable>()
  let lastContext: Context | null = null

  function pattern(expr: Pattern): void {
    // assume GSPO
    const context = store.get(expr.terms[0] as Key)!

    if (lastContext && context !== lastContext) {
      program.push([operations.call, null])
      lastContext = context
    }

    if (context instanceof Clause)
      // program.push([operations.setClause, context])
      throw new Error('todo: calls')
    else program.push([operations.setIndex, context])

    expr.terms.slice(1).forEach((term: Term | null, i) => {
      let op: string
      if (term!.termType === 'Variable') {
        if (term!.value[0] === '_') {
          op = 'AnonVariable'
          term = null
        } else {
          let mapped = variables.get(term as Variable)
          if (mapped) op = 'OldVariable'
          else {
            op = 'NewVariable'
            mapped = variable(randomString())
            variables.set(term as Variable, mapped)
          }
          term = mapped
        }
      }
      else op = 'Constant'

      program.push([
        // minus 2 because we're in a slice(1)
        operations[(i === expr.terms.length - 2 ? 'final' : 'medial') + op],
        term,
      ])
    })
  }

  traverse(query, { pattern })

  if (lastContext! instanceof Clause) program.push([operations.call, null])
  program.push([operations.emitResult, null])

  return [program, variables]
}
