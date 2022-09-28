import { Index } from './collections/index.js'
import { Prefixers } from './data-factory.js'
import { Bindings } from './processor.js'
import { A, Statement, Quad, Triple, Variable, Name } from './term.js'

export type VarMap = Bindings<Variable>

export type Mode = 'E' | 'I'

export interface Pattern<T extends Statement> {
  type: 'Pattern'
  mode: Mode
  terms: T
}

export interface Conjunction<S extends Statement, E = Expression<S>> {
  type: 'Conjunction'
  first: E
  rest: E | null
}

interface Disjunction {
  type: 'Disjunction'
  first: Expression<Quad>
  rest: Expression<Quad> | null
}

interface Negation {
  type: 'Negation'
  expr: Expression<Quad>
}

interface IfThenElse {
  type: 'IfThenElse'
  condition: Expression<Quad>
  then: Expression<Quad>
  else: Expression<Quad> | null
}

// this isn't quite right, because now Expression<FlatTriple> includes
// body-only (ie quad-only) types. does TS have type parameter polymorphism?
export type Expression<S extends Statement> =
  | Pattern<S>
  | Conjunction<S>
  | Disjunction
  | Negation // | IfThenElse

export type Head = Pattern<Triple> | Conjunction<Triple, Head>

const { fpc, rdf } = Prefixers

export function traverse(
  context: Index,
  root: Name,
  handlers: { [k: string]: (node: Name) => void },
) {
  const spo = context.getRoot('SPO')
  const stack: (Name | null)[] = [root]
  while (true) {
    const node = stack.pop()!

    if (node === null) continue
    if (node === undefined) return

    const po = spo.get(node)
    const types = po.get(A)
    if (types.has(fpc('Conjunction'))) {
      const [first] = po.get(rdf('first'))
      const [rest] = po.get(rdf('rest'))
      stack.push(rest, first)
    }
    if (types.has(fpc('Pattern'))) handlers.doPattern(node)
  }
}
