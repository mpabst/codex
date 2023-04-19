// @todo: sort out quads (in Context, addQuad()) vs triples (output is just
// triples)

import { Index } from '../collections/index.js'
import {
  namedNode,
  Prefixers,
  randomBlankNode,
  randomVariable,
  variable,
} from '../data-factory.js'
import {
  A,
  BlankNode,
  DEFAULT_GRAPH,
  DefaultGraph,
  Graph,
  Literal,
  Name,
  NamedNode,
  NIL,
  Object,
  Predicate,
  Quad,
  Subject,
  Triple,
  Variable,
} from '../term.js'
import { isLiteral, ParseError, unwrap } from './common.js'
import { Conjunction, Context, List } from './context.js'
import { Lexer, NoMoreTokens } from './lexer.js'
import { Namespace } from './namespace.js'

export type Anon = BlankNode | Variable
export type Place = keyof Triple | 'list' | 'done'

const { fpc } = Prefixers

export class Parser {
  // not static or in module scope because tests clear the dictionary
  // between every test, causing the expressions.includes() in parseObject()
  // to fail
  // alternatively, i could store these as strings and pass to fpc()
  // in parseObject(), or have a standard dictionary of known terms
  // which are never cleared
  readonly expressions = ['assert', 'retract', 'head', 'body'].map(fpc)

  namespace: Namespace
  base: NamedNode | DefaultGraph = DEFAULT_GRAPH

  protected lexer: Lexer
  token: string = ''

  context = new Context(this)

  output: Index | null = null
  resultAry: Quad[] = []

  constructor(
    name: Name,
    public source: string,
    public debug: boolean = false,
  ) {
    this.lexer = new Lexer(source)
    this.namespace = new Namespace(name.value)
  }

  protected get place(): Place {
    return this.context.place
  }

  protected set place(p: Place) {
    this.context.place = p
  }

  protected get graph() {
    return this.context.graph
  }

  protected set graph(g: Graph | undefined) {
    this.context.graph = g
  }

  protected get subject() {
    return this.context.subject
  }

  protected set subject(s: Subject | undefined) {
    this.context.subject = s
  }

  protected get predicate() {
    return this.context.predicate
  }

  protected set predicate(p: Predicate | undefined) {
    this.context.predicate = p
  }

  protected get object() {
    return this.context.object
  }

  protected set object(o: Object | undefined) {
    this.context.object = o
  }

  protected addListItem(o: Object): void {
    ;(this.context as List).addItem(o)
  }

  addQuad(q: Quad) {
    this.output!.add(q as Triple)
    this.resultAry.push({ ...q })
  }

  protected addResult(q: Partial<Quad>): void {
    this.context.addResult(q)
  }

  protected advance(): void {
    this.lexer.advance()
    this.token = this.lexer.token
  }

  protected anonEntity(): Anon {
    return this.context.anonEntity()
  }

  blankNode(): BlankNode {
    return randomBlankNode()
  }

  protected literal(): Literal {
    return this.namespace.literal(this.token)
  }

  protected namedNode(): NamedNode {
    return this.namespace.namedNode(this.token)
  }

  protected makeSubject(): Subject {
    return this.token[0] === '?'
      ? variable(this.token.slice(1))
      : this.namedNode()
  }

  protected makeObject(): Object {
    return isLiteral(this.token) ? this.literal() : this.makeSubject()
  }

  protected push(ctor: new (p: Parser) => Context = Context): void {
    this.context = new ctor(this)
  }

  protected pop(): void {
    this.context.pop()
  }

  protected unexpected(): ParseError {
    return new ParseError(
      `unexpected: ${this.token} as ${
        this.place
      } @ ${this.lexer.tokenStart.join(':')}`,
    )
  }

  variable(): Variable {
    return randomVariable()
  }

  parse(output: Index): Index {
    this.output = output
    try {
      while (true) {
        this.advance()
        switch (this.place) {
          case 'subject':
            this.parseSubject()
            break
          case 'predicate':
            this.parsePredicate()
            break
          case 'object':
            this.parseObject()
            break
          case 'done':
            this.parseDone()
            break
          case 'list':
            this.parseList()
            break
        }
      }
    } catch (e) {
      if (e instanceof NoMoreTokens) return this.output
      throw e
    }
  }

  protected parseSubject(): void {
    switch (this.token) {
      case 'base':
        this.advance()
        this.namespace.base = unwrap(this.token)
        this.base = namedNode(this.namespace.base)
        this.place = 'done'
        break
      case 'prefix':
        this.advance()
        const k = this.token.slice(0, -1)
        this.advance()
        this.namespace.prefixes[k] = this.namedNode().value
        this.place = 'done'
        break
      case '[':
        this.push()
        this.subject = this.anonEntity()
        break
      case '[]':
        this.subject = this.anonEntity()
        break
      case '(':
        this.push(List)
        break
      case '()': // not sure who'd use nil as a subject, but it seems legal
        this.subject = NIL
        break
      case '{':
      // @todo: all three of the below I want, and just haven't implemented
      case '<<':
      case '+':
      case '-':
        throw this.unexpected()
      default:
        // RDF doesn't allow literal subjects
        if (isLiteral(this.token)) throw this.unexpected()
        else this.subject = this.makeSubject()
    }
  }

  protected parsePredicate(): void {
    switch (this.token) {
      case '{':
        this.push()
        this.graph = this.subject!
        break
      case 'a':
        this.predicate = A
        break
      default:
        this.predicate = this.namedNode()
    }
  }

  protected parseObject(): void {
    switch (this.token) {
      case '[':
        this.push()
        const bnode = this.anonEntity()
        this.addResult({ object: bnode })
        this.subject = bnode
        break
      case '(':
        this.push(List)
        break
      case '()':
        this.object = NIL
        break
      case '<<':
        this.push()
        this.place = 'subject'
        break
      case '{':
        if (this.expressions.includes(this.predicate!)) {
          this.push(Conjunction)
          this.place = 'subject'
          break
        } else throw this.unexpected()
      default:
        this.addResult({ object: this.makeObject() })
        this.place = 'done'
    }
  }

  protected parseList(): void {
    switch (this.token) {
      case ')':
        this.pop()
        break
      case '[':
        const first = this.anonEntity()
        this.addListItem(first)
        this.push()
        this.subject = first
        break
      case '(':
      case '{':
      case '}':
      case '<<':
      // @todo: all of the above: lists, reifications, and graphs and
      // expressions nested in lists
      case '|': // @todo: cons destructuring
        throw this.unexpected()
      default:
        this.addListItem(this.makeObject())
    }
  }

  protected parseDone(): void {
    switch (this.token) {
      case ']':
      case '}':
      case '>>':
        this.pop()
        break
      case '|':
        throw this.unexpected()
      case ',':
        this.place = 'object'
        break
      case ';':
        this.place = 'predicate'
        break
      case '.':
        this.place = 'subject'
        break
      default:
        throw this.unexpected()
    }
  }
}
