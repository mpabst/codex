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

interface Line {
  readonly pattern: FlatQuad
  readonly order: Order
  readonly next: Line | null
}

export interface Query {
  and: FlatQuad[]
  or: Query[]
}

export function evol(
  qRoot: Branch,
  dRoot: Branch,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  const rootQTerms = Array.from(qRoot.keys())

  function doBranches(qTerm: Term, nextQ: Branch, data: Branch, nextRootIdx: number) {
    let penultimate = false

    function proceed(nextD: Branch) {
      for (const [k, v] of nextQ)
        penultimate
          ? doPenultimate(k, v as Twig, nextD, nextRootIdx)
          : doBranches(k, v as Branch, nextD, nextRootIdx)
    }

    for (const peek of nextQ.values()) {
      penultimate = peek instanceof Set
      break
    }

    const value = valueOrChoices(qTerm, data, () => {
      for (const [dTerm, nextD] of data) {
        bindings.set(qTerm as Variable, dTerm)
        proceed(nextD as Branch)
      }
    })

    if (!value || value === true) return

    const nextD = data.get(value)
    if (!nextD) return
    proceed(nextD as Branch)
  }

  function doPenultimate(qTerm: Term, nextQ: Twig, data: Branch, nextRootIdx: number) {
    const value = valueOrChoices(qTerm, data, () => {
      for (const [dTerm, nextD] of data) {
        bindings.set(qTerm as Variable, dTerm)
        doTwig(nextQ, nextD as Twig, nextRootIdx)
      }
    })

    if (!value || value === true) return

    const nextD = data.get(value)
    if (!nextD) return
    doTwig(nextQ, nextD as Twig, nextRootIdx)
  }

  function doRoot(nextRootIdx = 0) {
    if (nextRootIdx === rootQTerms.length) emit(new Map(bindings))
    else {
      const qTerm = rootQTerms[nextRootIdx]
      doBranches(qTerm, qRoot.get(qTerm)! as Branch, dRoot, nextRootIdx + 1)
    }
  }

  function doTwig(query: Twig, data: Twig, nextRootIdx: number) {
    for (const qTerm of query) {
      const value = valueOrChoices(qTerm, data, () => {
        for (const d of data) {
          bindings.set(qTerm as Variable, d)
          doRoot(nextRootIdx)
        }
      })

      if (!value || value === true || !data.has(value)) return

      doRoot(nextRootIdx)
    }
  }

  function valueOrChoices(
    qTerm: Term,
    data: Node,
    doChoices: () => void,
  ): Term | boolean {
    if (qTerm.termType !== 'Variable') return qTerm
    const value = bindings.get(qTerm as Variable)
    if (value) return value
    if (!data.size) return false
    doChoices()
    bindings.delete(qTerm as Variable)
    return true
  }

  doRoot()
}

export function evaluate(
  store: Store,
  query: Query,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  const goals = reorderGoals(query.and)

  function choose(
    line: Line | null,
    node: Node | null = null,
    termIndex: number = 0,
  ) {
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
        choose(line, v, termIndex + 1)
      }
      bindings.delete(term as Variable)
      return false
    }

    function doTwig(): boolean {
      node = node as Twig
      const { term, value } = getValue()

      if (value) return node.has(value)

      for (const t of node) {
        bindings.set(term as Variable, t)
        choose(line!.next)
      }
      bindings.delete(term as Variable)
      return false
    }

    function getValue(): { term: Term; value: Term | undefined } {
      const term: Term = line!.pattern[termIndex]
      if (term.termType === 'Variable')
        return { term, value: bindings.get(term as Variable) }
      return { term, value: term }
    }

    while (line) {
      if (termIndex === 0) node = store[line.order]
      for (; termIndex < line.pattern.length; termIndex++) {
        switch (node!.constructor) {
          case Map:
            if (!doBranch()) return
            break
          case Set:
            if (!doTwig()) return
            break
        }
      }
      termIndex = 0
      line = line.next
    }

    if (query.or.length) {
      for (const q of query.or) evaluate(store, q, emit, bindings)
    } else emit(new Map(bindings))
  }

  choose(goals)
}

function reorderGoals(goals: FlatQuad[]): Line | null {
  let out: Line | null = null
  for (let i = goals.length - 1; i >= 0; i--) {
    const order = 'SPOG' // indexOrder(goals[i])
    out = { pattern: reorder(order, goals[i]), order, next: out }
  }
  return out
}
