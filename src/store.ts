import { Clause } from './clause.js'
import { Index } from './collections/index.js'
import { BlankNode, Diff, Quad, NamedNode } from './term.js'

export type Key = NamedNode | BlankNode
export type Context = Clause | Index | Diff

export class Store {
  contexts: Map<Key, Context> = new Map()

  // what abt system listeners for things like rule compilation, etc
  constructor(data: Iterable<Quad>) {
    for (const d of data) {
      let context = this.get(d.graph as Key)
      if (!context) {
        context = new Index()
        this.set(d.graph as Key, context)
      }
      ;(context as Index).add([d.subject, d.predicate, d.object])
    }
  }

  get(term: Key): Context | undefined {
    return this.contexts.get(term)
  }

  set(term: Key, context: Context): void {
    this.contexts.set(term, context)
  }

  processEvent(event: Diff[]) {
    for (const diff of event) {
      // todo: heads, and exactly when and how to update which ones
      this.set(diff.id, diff)
      const snap = this.get(diff.target) as Index
      for (const ret of diff.retractions) snap.remove(ret)
      for (const ass of diff.assertions) snap.add(ass)
    }

    // for each quad in delta
    // - match against bodies of stratum 1
    // - re-eval with vars bound
    //   - for each result
    //     - if no body-only vars, just remove?
    //     - else try to rederive result
    //       - add to check set
    //       - if proven, add to proved set
    //       - else add to removals
    // set delta := removals, run to fixpoint
    // repeat for all strata
    // per stratum, removals then additions, then next stratum
    // rederivation should consider all known changes thus far?
    // just restrict heads to single bnodes or magic preds
    // kinda enforces good style anyways
    // - in that case, more efficient to separate check
    //   and proven sets by these two head modes, with
    //   bnodes just the set of the bnodes themselves
    // implement bnodes before forward-chaining?
    // well, multiple bnodes in heads would be handy
    // bnode reuse: idea is that if we're just mutating
    // an object, look for the corresponding (id same pred)
    // deletion when we do the addition. what if there are
    // a bunch of changes? most efficient is typically to
    // take the deleted bnode with the least edit distance,
    // but i'm guessing the cost of optimality won't be worth
    // the gain. just, first one we come across? maybe i could
    // do some kind of counting, count # of changed triples.
    // just first for now
  }
}
