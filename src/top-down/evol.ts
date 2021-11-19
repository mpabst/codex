import { Branch, Node, Twig } from '../collections/store'
import { Term, Variable } from '../term'
import { Bindings } from './query'

export function evol(
  qRoot: Branch,
  dRoot: Branch,
  emit: (b: Bindings) => void,
  bindings: Bindings = new Map(),
) {
  const rootQTerms = Array.from(qRoot.keys())

  function doBranches(
    qTerm: Term,
    nextQ: Branch,
    data: Branch,
    nextRootIdx: number,
  ) {
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

  function doPenultimate(
    qTerm: Term,
    nextQ: Twig,
    data: Branch,
    nextRootIdx: number,
  ) {
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
