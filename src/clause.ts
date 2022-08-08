import { A, builders, Prefixers, PREFIXES, unwrap } from './builders.js'
import { Branch, Node, Index } from './collections/index.js'
import { add } from './collections/tuple-set.js'
import { namedNode } from './data-factory.js'
import { Store } from './store.js'
import { BlankNode, FlatQuad, NamedNode, Term, Variable } from './term.js'
import { Bindings, evaluate } from './top-down/query.js'
import { Expression, Head, Pattern } from './syntax.js'

export class Clause {
  head = new Index()

  // We don't use the head just yet, because I'm manually matching
  // body patterns to their callees' head patterns, and once they're
  // matched, all we need are some bindings.
  constructor(
    public id: NamedNode | BlankNode,
    protected hub: Store,
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

  // bottom-up
  update() {}
}

const {v} = builders
const {fps} = Prefixers

const hub = new Store()

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
