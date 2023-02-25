import { randomBlankNode } from '../data-factory.js'
import {
  DEFAULT_GRAPH,
  Graph,
  Object,
  Predicate,
  Quad,
  Subject,
  Triple,
} from '../term.js'
import { Parser } from './parser.js'

type Place = keyof Triple | 'list' | 'done'

export class Context {
  place: Place
  quad: Partial<Quad>
  token: string

  constructor(parser: Parser | null) {
    if (!parser) {
      this.place = 'subject'
      this.quad = { graph: DEFAULT_GRAPH }
      this.token = ''
      return
    } else {
      this.place = parser.context.place
      this.quad = { ...parser.context.quad }
      this.token = parser.token
    }
  }

  // I think these can move to Parser, because I don't think I ever need to
  // resume building a quad: as I open a new context, be it a list, an expr,
  // or a reification, I always finish the quad that introduces it? I think
  // so...
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

  isReifying(): boolean {
    return this.token === '<<'
  }
}

export class Conjunction extends Context {
  entity: Subject = randomBlankNode()

  isReifying(): boolean {
    return true
  }
}
