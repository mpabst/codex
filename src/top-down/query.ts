import { FlatQuad, Term, Variable } from '../term.js'
import {
  indexOrder,
  reorder,
  Branch,
  Twig,
  Order,
  Node,
  Store,
} from '../collections/store.js'

export type Bindings = Map<Variable, Term>

type Conjunction = FlatQuad[]

type Section = 'and' | 'or'

interface Line {
  readonly pattern: FlatQuad
  readonly order: Order
  readonly next: Line | null
}

export interface Query {
  and: Conjunction
  or: Conjunction[]
}

interface QueryLines {
  and: Line | null
  or: Line[]
}

function reorderGoals(goals: FlatQuad[]): Line | null {
  let out: Line | null = null
  for (let i = goals.length - 1; i >= 0; i--)
    out = { pattern: goals[i], order: 'SPOG', next: out }
  return out
}

function reorderQuery(query: Query): QueryLines {
  const out: QueryLines = { and: null, or: [] }
  out.and = reorderGoals(query.and)
  for (const o of query.or) {
    let reordered = reorderGoals(o)
    if (reordered) out.or.push(reordered)
  }
  return out
}

interface Choice {
  node: Node | null
  line: Line | null
  section: Section
  termIndex: number
}

export function query(store: Store, query: Query, emit: (b: Bindings) => any) {
  const goals = reorderQuery(query),
    bindings: Bindings = new Map()

  function choose(choice: Choice) {
    const { section } = choice
    let { node, line, termIndex } = choice

    function getValue(): { term: Term; value: Term | undefined } {
      const term: Term = line!.pattern[termIndex]
      if (term.termType === 'Variable')
        return { term, value: bindings.get(term as Variable) }
      return { term, value: term }
    }

    function doTwig(): boolean {
      node = node as Twig
      const { term, value } = getValue()

      if (value) return node.has(value)

      for (const t of node) {
        bindings.set(term as Variable, t)
        choose({ line: line!.next, node: null, section, termIndex: 0 })
      }
      bindings.delete(term as Variable)
      return false
    }

    function doBranch(): boolean {
      node = node as Branch
      const { term, value } = getValue()

      if (value) {
        const found = node.get(value)
        if (!found) return false
        node = found
        return true
      }

      for (const [k, v] of node!.entries()) {
        bindings.set(term as Variable, k)
        choose({ line, node: v, section, termIndex: termIndex + 1 })
      }
      bindings.delete(term as Variable)
      return false
    }

    while (line) {
      if (termIndex === 0) node = store[line.order]
      for (; termIndex < line.pattern.length; termIndex++) {
        switch (node!.constructor) {
          case Set:
            if (!doTwig()) return
            break
          case Map:
            if (!doBranch()) return
            break
        }
      }
      termIndex = 0
      line = line.next
    }

    switch (section) {
      case 'and':
        emit(new Map(bindings))
        return
      default: throw "unknown section"
    }
  }

  // TODO: validate we actually have a query body

  choose({
    line: goals.and,
    node: null,
    section: 'and',
    termIndex: 0,
  })
}
