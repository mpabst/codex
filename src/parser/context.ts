import { Graph, Object, Predicate, Quad, Subject, Triple } from '../term.js'

type Place = keyof Triple | 'list' | 'done'

export class Context {
  constructor(
    public type: string,
    public place: Place,
    public quad: Partial<Quad>,
  ) {}

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

  branch(token: string): Context {
    return new Context(token, this.place, { ...this.quad })
  }
}
