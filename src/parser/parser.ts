import { QuadSet } from '../collections/data-set.js'
import { Prefixers, randomBlankNode, variable } from '../data-factory.js'
import {
  DEFAULT_GRAPH,
  Literal,
  NamedNode,
  Object,
  Quad,
  Subject,
} from '../term.js'
import { ParseError, unwrap } from './common.js'
import { Context } from './context.js'
import { Lexer, NoMoreTokens } from './lexer.js'
import { Namespace } from './namespace.js'

const { fpc, rdf } = Prefixers

export class Parser {
  namespace = new Namespace()

  lexer: Lexer
  token: string = ''

  stack = [new Context('', 'subject', { graph: DEFAULT_GRAPH })]

  rContext: Context | null = null

  result = new QuadSet('GSPO')
  resultAry: Quad[] = []

  constructor(public source: string) {
    this.lexer = new Lexer(source)
  }

  protected addListNode(first: Object): void {
    const node = randomBlankNode()
    this.addQuad({ object: node })
    this.addQuad({
      subject: node,
      predicate: rdf('type'),
      object: rdf('List'),
    })
    this.addQuad({ predicate: rdf('first'), object: first })
    this.context.predicate = rdf('rest')
    this.context.place = 'list'
  }

  protected addQuad(quad: Partial<Quad>): void {
    this.context.quad = { ...this.context.quad, ...quad }
    if (this.rContext) this.addReifiedQuad(quad)
    else {
      this.result.add(this.context.quad as Quad)
      this.resultAry.push({ ...(this.context.quad as Quad) })
    }
  }

  protected addReifiedQuad(q: Partial<Quad>): void {
    const mutate = (q: Partial<Quad>) => {
      this.result.add({ ...q } as Quad)
      this.resultAry.push({ ...q } as Quad)
    }

    const bnode = randomBlankNode()
    mutate({ ...this.rContext!.quad, object: bnode })

    const add = (q: Partial<Quad>) =>
      mutate({ graph: this.rContext!.graph!, subject: bnode, ...q })

    let type
    if (this.context.graph === this.rContext!.graph) type = rdf('Statement')
    else {
      type = fpc('Pattern')
      add({ predicate: fpc('graph'), object: this.context.graph! })
    }
    add({ predicate: rdf('type'), object: type })
    for (const p of ['subject', 'predicate', 'object'])
      add({ predicate: rdf(p), object: this.context.quad[p]! })
  }

  protected advance(): void {
    this.lexer.advance()
    this.token = this.lexer.token
  }

  protected get context(): Context {
    return this.stack[this.stack.length - 1]
  }

  protected isLiteral(): boolean {
    return (
      /^[+-\d'"]/.test(this.token) || ['true', 'false'].includes(this.token)
    )
  }

  protected literal(): Literal {
    return this.namespace.literal(this.token)
  }

  protected makeObject(): Object {
    return this.isLiteral() ? this.literal() : this.makeSubject()
  }

  protected makeSubject(): Subject {
    return this.token[0] === '?'
      ? variable(this.token.slice(1))
      : this.namedNode()
  }

  protected namedNode(): NamedNode {
    return this.namespace.namedNode(this.token)
  }

  parse(): QuadSet {
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
      if (e instanceof NoMoreTokens) return this.result
      throw e
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

  protected parseList(): void {
    switch (this.token) {
      case ')':
        this.addQuad({ object: rdf('nil') })
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

  protected parseObject(): void {
    switch (this.token) {
      case '[':
        this.push()
        const bnode = randomBlankNode()
        this.addQuad({ object: bnode })
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
        if (this.context.predicate === fpc('')) break
      default:
        this.addQuad({ object: this.makeObject() })
        this.context.place = 'done'
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

  protected parseSubject(): void {
    switch (this.token) {
      case 'base':
        this.advance()
        this.namespace.base = unwrap(this.token)
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
      case '<<':
      case '+':
      case '-':
        throw this.unexpected()
      default:
        if (this.isLiteral()) throw this.unexpected()
        this.context.subject = this.makeSubject()
    }
  }

  protected pop(): void {
    if (this.context.type === '<<')
      // originally i had this branch set a dirty flag, which would
      // then update rContext in a custom getter, but that didn't work
      // for some reason and it doesn't seem worth debugging
      for (let i = this.stack.length - 2; i > 0; i--)
        if (this.stack[i].type === '<<') this.rContext = this.stack[i - 1]
        else if (i === 1) this.rContext = null
    this.stack.pop()!
    this.context.place = this.context.place === 'list' ? 'list' : 'done'
  }

  protected push(): void {
    if (this.token === '<<') this.rContext = this.context
    this.stack.push(this.context.branch(this.token))
  }

  protected unexpected(): ParseError {
    return new ParseError(`unexpected: ${this.token} @ ${this.context.place}`)
  }
}
