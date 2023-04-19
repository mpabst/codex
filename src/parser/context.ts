import {
  Prefixers
} from '../data-factory.js'
import {
  A,
  BlankNode,
  DEFAULT_GRAPH,
  Graph,
  NIL,
  Object,
  Predicate,
  Quad,
  Subject
} from '../term.js'
import { Anon, Parser, Place } from './parser.js'

const { fpc, rdf } = Prefixers

export class Context {
  expr: Context | null
  readonly parent: Context | null
  place: Place
  readonly quad: Partial<Quad>
  reifier: Context | null
  token: string

  constructor(public parser: Parser) {
    this.token = parser.token

    const { context: parent } = parser
    if (parent) {
      this.expr = this.isExpr() ? this : parent.expr
      this.parent = parent
      this.place = parent.place
      this.quad = { ...parent.quad }

      // only copies prev.quad up to the current place - worth the trouble?
      // quad will still have old data so long as the context lasts past a
      // single statement
      // const placeIndex = TRIPLE_PLACES.indexOf(this.place)
      // for (let i = 0; i <= placeIndex; i++) {
      //   const place = TRIPLE_PLACES[i]
      //   this.quad[place] = parent.quad[place]
      // }

      this.reifier = this.isReifier() ? this : parent.reifier
    } else {
      this.expr = null
      this.parent = null
      this.place = 'subject'
      this.quad = { graph: DEFAULT_GRAPH }
      this.reifier = null
    }
  }

  get graph() {
    return this.quad.graph
  }

  get subject() {
    return this.quad.subject
  }

  get predicate() {
    return this.quad.predicate
  }

  get object() {
    return this.quad.object
  }

  set graph(g: Graph | undefined) {
    this.quad.graph = g
    this.place = 'subject'
  }

  set subject(s: Subject | undefined) {
    this.quad.subject = s
    this.place = 'predicate'
  }

  set predicate(p: Predicate | undefined) {
    this.quad.predicate = p
    this.place = 'object'
  }

  set object(o: Object | undefined) {
    this.quad.object = o
    this.place = 'done'
  }

  protected addPattern(quad: Quad): void {
    this.addQuad({
      graph: this.reifier!.graph!,
      subject: (this.expr as Conjunction).node,
      predicate: fpc('conjunct'),
      object: this.addReification(quad),
    })
  }

  protected addQuad(q: Quad): void {
    this.parser.addQuad(q)
  }

  // @todo: have the base context translate the default graph to the name of the
  // current module? well, if parser.output is just a TripleSet, why bother?
  addResult(q: Partial<Quad>): void {
    const quad = { ...this.quad, ...q } as Quad
    if (this.expr) this.addPattern(quad)
    else if (this.reifier)
      this.addQuad({
        // @fixme is this right? don't we want to call only addReification()?
        ...this.reifier!.quad,
        object: this.addReification(quad),
      } as Quad)
    else this.addQuad(quad)
  }

  protected addReification(
    quad: Quad,
    bnode: Anon = this.anonEntity(),
  ): BlankNode {
    const add = (q: Partial<Quad>) =>
      this.addQuad({
        graph: this.reifier!.graph!,
        subject: bnode,
        ...q,
      } as Quad)

    let type = rdf('Statement')
    if (this.expr || quad.graph !== this.reifier!.graph) {
      type = fpc('Pattern')
      add({ predicate: fpc('graph'), object: quad.graph })
    }
    add({ predicate: rdf('type'), object: type })

    for (const p of ['subject', 'predicate', 'object'])
      add({ predicate: rdf(p), object: quad[p] })

    return bnode
  }

  anonEntity(): Anon {
    if (this.expr) return this.parser.variable()
    else return this.parser.blankNode()
  }

  isExpr(): boolean {
    return false
  }

  isReifier(): boolean {
    return this.token === '<<'
  }

  pop(): void {
    this.parser.context = this.parent!
  }
}

export class Conjunction extends Context {
  node: Subject = this.parser.blankNode()

  constructor(parser: Parser) {
    super(parser)
    this.parent!.addResult({ object: this.node })
    this.parent!.addResult({
      subject: this.node,
      predicate: A,
      object: fpc('Conjunction'),
    })
  }

  isExpr(): boolean {
    return true
  }

  isReifier(): boolean {
    return true
  }
}

export class List extends Context {
  length = 0
  node: BlankNode = this.anonEntity()
  #pending: Quad | null = null

  constructor(parser: Parser) {
    super(parser)
    if (this.place === 'object') this.pending = { object: this.node }
    this.place = 'list'
  }

  protected get pending(): Partial<Quad> | null {
    return this.#pending
  }

  protected set pending(p: Partial<Quad> | null) {
    this.#pending = { ...this.quad, ...p } as Quad
  }

  addItem(object: Object): void {
    this.addResult(this.pending as Quad)
    this.subject = this.node
    super.addResult({ predicate: A, object: rdf('List') })
    super.addResult({ predicate: rdf('first'), object })
    this.predicate = rdf('rest')
    this.node = this.anonEntity()
    this.pending = { object: this.node }
  }

  pop(): void {
    super.pop()
    // first branch is if we opened and immediately closed a list in the subject
    // position, ie are using rdf:nil as our subject
    if (!this.length && !this.pending) this.parent!.subject = NIL
    else this.addResult({ object: NIL })
  }
}
