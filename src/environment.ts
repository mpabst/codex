import { QuadSet } from './collections/data-set.js'
import { Module } from './module.js'
import { Bindings, Processor } from './processor.js'
import { Diff, Name, NamedNode, Quad } from './term.js'

export class Environment {
  loading = new Map<Name, Promise<Module>>()
  modules = new Map<Name, Module>()
  proc = new Processor()

  // what abt system listeners for things like rule compilation, etc
  constructor(data: Iterable<Quad> = []) {
    // for (const d of data) {
    //   if (d.graph === DEFAULT_GRAPH) throw new Error('default graph not allowed here')
    //   let module = this.modules.get(d.graph)
    //   // fixme: need to delay this ctor till facts are assembled
    //   if (!module) module = new Module(this, d.graph)
    //   module.facts.add(d)
    // }
  }

  load(name: NamedNode): Promise<Module> {
    let loading = this.loading.get(name)
    if (loading) return loading
    loading = new Promise(async (resolve, reject) => {
      if (this.modules.has(name)) return resolve(this.modules.get(name)!)
      // todo: normalize path, query string, etc?
      // maybe fetch whatever, have server specify canonical, use that?
      // where would non-normal iris be coming from tho?
      const resp = await fetch(name.value)
      if (!resp.ok) reject(new Error(`error loading module: ${name}`))
      else resolve(Module.parse(this, name, await resp.text()))
    })
    this.loading.set(name, loading)
    return loading
  }

  processEvent(event: Diff[]) {
    type WorkItem = [Body, Bindings]

    for (const diff of event) {
      const delta = new QuadSet('GSPO')
      const worklist: WorkItem[] = []
      delta.root.set(diff.target, diff.retractions)
      delta.forEach((d: Quad) => {
        // proc.evaluate(
        //   compileMatcher(target.listeners, d),
        //   (listener: Quad) => {
        //     // opt: let Processor.evaluate() take a Term[] for its
        //     // args, just use it as the initial heap?
        //     const args: Bindings = new Map()
        //     for (const p of QUAD_PLACES)
        //       if (listener[p] instanceof Variable)
        //         args.set(listener[p], d[p])
        //     worklist.push([listener.graph, args])
        //   }
        // )
      })
      for (const item of worklist) {
        // lookup Query, set Processor.memo, evaluate()
        // addTriple branches on Processor.direction, adding
        // to a head memo or a bottom-up delta as appropriate
        // i think the only difference is that for dir = up,
        // first check the memo to see whether we need it
        // maybe have a second field, Processor.delta
      }
      // take our memo, filter out anything we already have
    }
  }
}
