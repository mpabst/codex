import { Clause } from './clause.js'
import { Index } from './collections/index.js'
import { Module } from './module.js'
import { Diff, Quad, NamedNode, DEFAULT_GRAPH, Node } from './term.js'

export class Store {
  modules = new Map<Node, Module>()
  clauses = new Map<Node, Clause>()

  // what abt system listeners for things like rule compilation, etc
  constructor(data: Iterable<Quad>) {
    for (const d of data) {
      if (d.graph === DEFAULT_GRAPH) throw new Error('default graph not allowed here')
      let module = this.modules.get(d.graph)
      if (!module) module = new Module(this, d.graph)
      module.facts.add(d)
    }
  }

  async load({ value: iri }: NamedNode): Promise<void> {
    const resp = await fetch(iri)
    if (!resp.ok) throw new Error(`Error loading module: ${iri}`)
    Module.parse(this, await resp.text())
  }

  processEvent(event: Diff[]) {
    let delta = new Index()

    for (const diff of event) {
      // todo: heads, and exactly when and how to update which ones
      // this.set(diff.id, diff)
      const snap = this.get(diff.target) as Index
      for (const ret of diff.retractions) {
        snap.delete(ret)
        delta.add(ret)
      }
      for (const ass of diff.assertions) snap.add(ass)
    }

    while (delta.size > 0) {}

    delta = new Index()
    for (const diff of event) for (const ass of diff.assertions) delta.add(ass)

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
