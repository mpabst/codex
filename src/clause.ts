import { A, builders, Prefixers, PREFIXES, unwrap } from './builders'
import { Branch, Node, Store } from './collections/store'
import { add } from './collections/tuple-set'
import { namedNode } from './data-factory'
import { Hub } from './hub'
import { BlankNode, FlatQuad, NamedNode, Term, Variable } from './term'
import { Bindings, evaluate } from './top-down/query'
import { Expression, Head, Pattern } from './top-down/syntax'

function flatten(head: Head): Pattern[] {
  const out: Pattern[] = []
  const stack: [Head | null] = [head]
  let expr: Head | null

  while (true) {
    expr = stack.pop()!
    if (expr === null) continue
    if (expr === undefined) return out
    switch (expr.type) {
      case 'Conjunction':
        stack.push(expr.rest, expr.first)
        continue
      case 'Pattern':
        out.push(expr)
        continue
    }
  }
}

class Memo {
  // Variable is the callee's name, not the caller's
  calls: Map<Variable, Map<Term, Set<Bindings>>> = new Map()
  store = new Store()
}

export class Clause {
  protected head = new Store()
  protected memo = new Memo()

  // We don't use the head just yet, because I'm manually matching
  // body patterns to their callees' head patterns, and once they're
  // matched, all we need are some bindings.
  constructor(
    public id: NamedNode | BlankNode,
    protected hub: Hub,
    head: Head,
    protected body: Expression,
  ) {
    for (const {terms} of flatten(head)) add(this.head.getIndex('SPO'), terms)
    hub.set(id, this)
  }

  call(bindings: Bindings): Bindings[] {
    // TODO: check memo
    return evaluate(this.hub, this.body, bindings)
  }

  // out is callee -> caller
  unify(terms: FlatQuad): Bindings[] {
    const out: Bindings[] = []
    const current: [Variable, Term]
    function inner(term: Term, node: Node): void {
      if (node instanceof Set) {
        if (term.termType !== 'Variable') {
          if (node.has(term)) out.push(new Map())
        }
      }
    }
    inner(terms[1], this.head.getIndex('SPO'))
    return out
  }

  // bottom-up
  update() {}
}

const {v} = builders
const {fps} = Prefixers

const hub = new Hub()

const mortal = new Clause(
  hub,
  namedNode(`${PREFIXES.fps}mortal`),
  {
    type: 'Pattern',
    terms: unwrap(fps.test, v.person, A, fps.mortal),
    order: 'GSPO',
  },
  new Query(
    {
      type: 'Pattern',
      terms: unwrap(fps.test, v.person, A, fps.man),
      order: 'GSPO',
    },
    [],
  ),
)
