// todo:
// move add, pop/push logic into Context
// ListContext

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
  DefaultGraph,
  DEFAULT_GRAPH,
  Literal,
  Name,
  NamedNode,
  Object,
  Quad,
  Subject,
  Triple,
  Variable,
} from '../term.js'
import { isLiteral, ParseError, unwrap } from './common.js'
import { Context, Conjunction } from './context.js'
import { Lexer, NoMoreTokens } from './lexer.js'
import { Namespace } from './namespace.js'

const { fpc, rdf } = Prefixers

export class Parser {
  // not static or in module scope because tests clear the dictionary
  // between every test, causing the expressions.includes() in parseObject()
  // to fail
  // alternatively, i could store these as strings and pass to fpc()
  // in parseObject(), or have a standard dictionary of known terms
  // which are never cleared
  expressions = ['assert', 'retract', 'head', 'body'].map(fpc)

  namespace: Namespace
  base: NamedNode | DefaultGraph = DEFAULT_GRAPH

  lexer: Lexer
  token: string = ''

  stack = [new Context(null)]
  firstExpr: number | null = null

  rContext: Context | null = null

  output: Index | null = null
  resultAry: Quad[] = []

  constructor(name: Name, public source: string) {
    this.lexer = new Lexer(source)
    this.namespace = new Namespace(name.value)
  }

  protected addListNode(first: Object): void {
    const node = this.blankNode()
    this.addResult({ object: node })
    this.addResult({
      subject: node,
      predicate: rdf('type'),
      object: rdf('List'),
    })
    this.addResult({ predicate: rdf('first'), object: first })
    this.context.predicate = rdf('rest')
    this.context.place = 'list'
  }

  protected addPattern(): void {
    const expr = this.nearest(c => c instanceof Conjunction) as Conjunction
    this.addQuad({
      graph: this.rContext!.graph!,
      subject: expr.entity,
      predicate: fpc('conjunct'),
      object: this.addReification(),
    })
  }

  protected addQuad(q: Quad) {
    this.output!.add(q as Triple)
    this.resultAry.push({ ...q })
  }

  // TODO: move this into Context et al, have a TopLevel context which just
  // does addQuad()
  protected addResult(quad: Partial<Quad>): void {
    this.context.quad = { ...this.context.quad, ...quad }
    if (this.isInExpression()) this.addPattern()
    else if (this.rContext)
      this.addQuad({
        ...this.rContext!.quad,
        object: this.addReification(),
      } as Quad)
    else this.addQuad(this.context.quad as Quad)
  }

  protected addReification(bnode: BlankNode = randomBlankNode()): BlankNode {
    const add = (q: Partial<Quad>) =>
      this.addQuad({
        graph: this.rContext!.graph!,
        subject: bnode,
        ...q,
      } as Quad)

    let type = rdf('Statement')
    if (this.isInExpression() || this.context.graph !== this.rContext!.graph) {
      type = fpc('Pattern')
      add({ predicate: fpc('graph'), object: this.context.graph! })
    }
    add({ predicate: rdf('type'), object: type })

    for (const p of ['subject', 'predicate', 'object'])
      add({ predicate: rdf(p), object: this.context.quad[p]! })

    return bnode
  }

  protected advance(): void {
    this.lexer.advance()
    this.token = this.lexer.token
  }

  protected blankNode(): BlankNode | Variable {
    return this.isInExpression() ? randomVariable() : randomBlankNode()
  }

  get context(): Context {
    return this.stack[this.stack.length - 1]
  }

  protected isInExpression(): boolean {
    return this.firstExpr !== null
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

  protected nearest<C extends Context>(
    test: (c: Context) => boolean,
  ): C | null {
    for (let i = this.stack.length - 1; i > -1; i--)
      if (test(this.stack[i])) return this.stack[i] as C
    return null
  }

  protected push(ctor: new (p: Parser) => Context = Context): void {
    const newContext = new ctor(this)
    if (newContext instanceof Conjunction) {
      this.addResult({ object: newContext.entity })
      this.addResult({
        subject: newContext.entity,
        predicate: A,
        object: fpc('Conjunction'),
      })
      if (!this.firstExpr) this.firstExpr = this.stack.length
    }
    if (newContext.isReifying()) this.rContext = this.context
    this.stack.push(newContext)
  }

  // probably want to move most of this logic into Context et al;
  // ditto push()
  protected pop(): void {
    if (this.context.isReifying()) {
      // originally I had this branch set a dirty flag, which would
      // then update rContext in a custom getter, but that didn't work
      // for some reason and it doesn't seem worth debugging
      for (let i = this.stack.length - 2; i > 0; i--)
        // FIXME: expressions inside reifications?
        if (this.stack[i].isReifying()) this.rContext = this.stack[i - 1]
        else if (i === 1) this.rContext = null
    }

    this.stack.pop()!
    if (this.firstExpr === this.stack.length) this.firstExpr = null
    this.context.place = this.context.place === 'list' ? 'list' : 'done'
  }

  protected unexpected(): ParseError {
    return new ParseError(`unexpected: ${this.token} @ ${this.context.place}`)
  }

  parse(output: Index): Index {
    this.output = output
    try {
      while (true) {
        this.advance()
        switch (this.context.place) {
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
        this.context.place = 'done'
        break
      case 'prefix':
        this.advance()
        const k = this.token.slice(0, -1)
        this.advance()
        this.namespace.prefixes[k] = this.namedNode().value
        this.context.place = 'done'
        break
      case '[':
        this.push()
        this.context.subject = this.blankNode()
        break
      case '[]':
        this.context.subject = this.blankNode()
        break
      case '(':
        throw this.unexpected()
      case '()':
        this.context.subject = rdf('nil')
        break
      case '{':
      // TODO: << seems fine?
      case '<<':
      case '+':
      case '-':
        throw this.unexpected()
      default:
        if (isLiteral(this.token)) throw this.unexpected()
        this.context.subject = this.makeSubject()
    }
  }

  protected parsePredicate(): void {
    switch (this.token) {
      case '{':
        this.push()
        this.context.graph = this.context.subject!
        break
      case 'a':
        this.context.predicate = rdf('type')
        break
      default:
        this.context.predicate = this.namedNode()
    }
  }

  protected parseObject(): void {
    switch (this.token) {
      case '[':
        this.push()
        const bnode = this.blankNode()
        this.addResult({ object: bnode })
        this.context.subject = bnode
        break
      case '(':
        this.push()
        this.context.place = 'list'
        break
      case '<<':
        this.push()
        this.context.place = 'subject'
        break
      case '{':
        if (this.expressions.includes(this.context.predicate!)) {
          this.push(Conjunction)
          this.context.place = 'subject'
          break
        } else throw this.unexpected()
      default:
        this.addResult({ object: this.makeObject() })
        this.context.place = 'done'
    }
  }

  protected parseList(): void {
    switch (this.token) {
      case ')':
        this.addResult({ object: rdf('nil') })
        this.pop()
        break
      case '[':
        const first = this.blankNode()
        this.addListNode(first)
        this.push()
        this.context.subject = first
        break
      case '(':
      case '{':
      case '}':
      case '<<':
        throw this.unexpected()
      default:
        this.addListNode(this.makeObject())
    }
  }

  protected parseDone(): void {
    switch (this.token) {
      case ']':
      case ')':
      case '}':
      case '>>':
        this.pop()
        break
      case '|':
        throw this.unexpected()
      case ',':
        this.context.place = 'object'
        break
      case ';':
        this.context.place = 'predicate'
        break
      case '.':
        this.context.place = 'subject'
        break
      default:
        throw this.unexpected()
    }
  }
}
