// todo:
// move add, pop/push logic into Context
// ListContext

import { Index } from '../collections/index.js'
import {
  namedNode,
  Prefixers,
  randomBlankNode,
  variable,
} from '../data-factory.js'
import { Store } from '../store.js'
import {
  BlankNode,
  DefaultGraph,
  DEFAULT_GRAPH,
  Literal,
  NamedNode,
  Object,
  Quad,
  Subject,
  Triple,
} from '../term.js'
import { ParseError, unwrap } from './common.js'
import { Context, Expression } from './context.js'
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

  namespace = new Namespace()
  base: NamedNode | DefaultGraph = DEFAULT_GRAPH

  lexer: Lexer
  token: string = ''

  stack = [new Context(null)]
  firstExpr: number | null = null

  rContext: Context | null = null

  resultAry: Quad[] = []

  constructor(protected store: Store, public source: string) {
    this.lexer = new Lexer(source)
  }

  protected addListNode(first: Object): void {
    const node = randomBlankNode()
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
    const expr = this.nearest(c => c instanceof Expression) as Expression

    if (!expr.head) {
      expr.head = this.addReification()
      return
    }

    const graph = this.rContext!.graph!
    let bnode = randomBlankNode()
    const add = (q: Partial<Quad>) =>
      this.addQuad({ graph, subject: bnode, ...q } as Quad)

    if (!expr.tail) {
      // head is just a Pattern, let's wrap it in a Conj
      add({ predicate: rdf('type'), object: fpc('Conjunction') })
      add({ predicate: rdf('first'), object: expr.head })
      expr.head = expr.tail = bnode
      bnode = randomBlankNode()
    }

    this.addQuad({
      graph,
      subject: expr.tail,
      predicate: rdf('rest'),
      object: bnode,
    })
    add({ predicate: rdf('type'), object: fpc('Conjunction') })
    add({ predicate: rdf('first'), object: this.addReification() })

    expr.tail = bnode
  }

  protected addQuad(q: Quad) {
    const graph =
      q.graph === DEFAULT_GRAPH ? namedNode(this.namespace.base) : q.graph
    let index = this.store.get(graph) as Index
    if (!index) {
      index = new Index()
      this.store.set(graph, new Index())
    }
    index.add(q as Triple)
    this.resultAry.push({ ...q })
  }

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
    if (this.isInExpression() || this.context.graph === this.rContext!.graph) {
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

  get context(): Context {
    return this.stack[this.stack.length - 1]
  }

  protected isInExpression(): boolean {
    return this.firstExpr !== null
  }

  protected isLiteral(): boolean {
    return (
      /^[+-\d'"]/.test(this.token) || ['true', 'false'].includes(this.token)
    )
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
    return this.isLiteral() ? this.literal() : this.makeSubject()
  }

  protected nearest(test: (c: Context) => boolean): Context | null {
    for (let i = this.stack.length - 1; i > -1; i--)
      if (test(this.stack[i])) return this.stack[i]
    return null
  }

  protected push(ctor: new (p: Parser) => Context = Context): void {
    const newContext = new ctor(this)
    if (newContext.isReifying()) this.rContext = this.context
    if (ctor === Expression && !this.firstExpr)
      this.firstExpr = this.stack.length
    this.stack.push(newContext)
  }

  // probably want to move most of this logic into Context & Expression;
  // ditto push()
  protected pop(): void {
    if (this.context instanceof Expression) {
      // button up the subexpr we've just completed
      // todo: first check this.result to see the type
      // of this.context.tail
      // this.addQuad({
      //   graph: this.rContext!.graph,
      //   subject: this.context.tail,
      //   predicate: rdf('rest'),
      //   object: rdf('nil'),
      // } as Quad)

      const prev = this.stack[this.stack.length - 2]
      if (prev instanceof Expression) {
        if (!prev.head) prev.head = this.context.head
        else {
          // prev.tail = new conj/disj with head = this.context.head
          throw 'todo'
        }
      } else
        this.addQuad({
          ...this.rContext!.quad,
          object: this.context.head,
        } as Quad)
    }

    if (this.context.isReifying()) {
      // originally I had this branch set a dirty flag, which would
      // then update rContext in a custom getter, but that didn't work
      // for some reason and it doesn't seem worth debugging
      for (let i = this.stack.length - 2; i > 0; i--)
        // fixme: expressions inside reifications?
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

  parse(): void {
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
      if (e instanceof NoMoreTokens) return
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
        this.context.subject = randomBlankNode()
        break
      case '[]':
        this.context.subject = randomBlankNode()
        break
      case '(':
        throw this.unexpected()
      case '()':
        this.context.subject = rdf('nil')
        break
      case '{':
        if (this.context instanceof Expression) {
          this.push(Expression)
          break
        } else throw this.unexpected()
      case '<<':
      case '+':
      case '-':
        throw this.unexpected()
      default:
        if (this.isLiteral()) throw this.unexpected()
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
        const bnode = randomBlankNode()
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
          this.push(Expression)
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
        const first = randomBlankNode()
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
