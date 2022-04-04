import { Store } from './collections/store.js'
import { TupleSet, forEach } from './collections/tuple-set.js'
import { randomBlankNode } from './data-factory.js'
import { BlankNode, Subject, Term } from './term.js'

// maybe don't implement Pushee, because we expect a different
// type? or maybe make all Pushees expect a type?
export class Interpreter {
  readonly root: Context
  readonly contexts: Map<BlankNode, Context> = new Map()
  // these need to be patches - just expect meta/add/del breakdown?
  // just use the regular store, so we don't have to copy
  // have a special queue graph which we patch separately
  // and which lists the incoming patches
  // readonly queue: TupleSet<Term>[] = []

  constructor(readonly store: Store, readonly rootSource: Subject) {
    this.root = new Context(this, rootSource)
  }

  tick() {
    // shift from queue
    // apply patches
    // build: update contexts if necc
    // push updates thru
  }
}

enum Status { Empty, Partial, Complete }

class Result {
  constructor(public readonly staus: Status, ) {

  }
}

interface Pullee {
  pull(/* syntax fragments */): TupleSet<Term>
}

interface Pushee {
  // TODO: make return type some kind of status
  push(quads: TupleSet<Term> /* or syntax fragments again? */): void
}

class ConsoleWriter implements Pushee {
  push(quads: TupleSet<Term>): void {
    forEach(quads, console.log)
  }
}

class Context {
  readonly up: Map<BlankNode, Pullee> = new Map()
  // OPT, minor: this could probs b an array
  readonly down: Set<Pushee> = new Set()
  readonly name: BlankNode = randomBlankNode()
  protected readonly store: Store

  constructor(
    protected readonly system: Interpreter,
    readonly source: Subject,
    // TODO: arguments
  ) {
    this.store = system.store
    this.build()
    system.contexts.set(this.name, this)
    this.eval()
  }

  build() {
    // TODO: eval build-time rules
    // find or create upstreams from imports
    // ctor Rules
  }

  eval() {

  }

  remove() {
    this.system.contexts.delete(this.name)
  }
}
