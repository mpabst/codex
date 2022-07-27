import {Store} from './collections/store'
import {randomBlankNode} from './data-factory'
import {RootIndex} from './system'
import {FlatQuad, Term, Variable} from './term'
import {Bindings} from './top-down/query'
import {Expression, Head, Pattern} from './top-down/syntax'

// const {v} = builders
// const {fps} = Prefixers

// const rule: Rule = {
//   head: {
//     type: 'Pattern',
//     terms: unwrap(v.person, A, fps.mortal, fps.test),
//     order: 'GSPO',
//   },
//   body: {
//     type: 'Pattern',
//     terms: unwrap(v.person, A, fps.man, fps.test),
//     order: 'SGPO',
//   },
// }

function assertHead(head: Head, bindings: Bindings, store: Store) {
  const stack: [Head | null] = [head]
  let expr: Head | null

  function doPattern() {
    const out: Term[] = []
    for (const term of (expr as Pattern).terms) {
      if (term.termType === 'Variable') {
        let bound = bindings.get(term)
        if (!bound) {
          bound = randomBlankNode()
          bindings.set(term, bound)
        }
        out.push(bound)
      } else out.push(term)
    }
    store.add(out as FlatQuad)
  }

  while (true) {
    expr = stack.pop()!
    if (expr === null) continue
    if (expr === undefined) return
    switch (expr.type) {
      case 'Conjunction':
        stack.push(expr.rest, expr.first)
        continue
      case 'Pattern':
        doPattern()
        continue
    }
  }
}

class Memo {
  // Variable is the callee's name, not the caller's
  calls: Map<Variable, Map<Term, Set<Bindings>>> = new Map()
  store = new Store()
}

export class Rule {
  protected memo = new Memo()

  // We don't use the head just yet, because I'm manually matching
  // body patterns to their callees' head patterns, and once they're
  // matched, all we need are some bindings.
  constructor(
    public rootIndex: RootIndex,
    public head: Head,
    public body: Expression,
  ) {}

  call(bindings: Bindings, emit: (b: Bindings) => void): void {
    // TODO: check memo
  }

  // bottom-up
  update() {}
}
