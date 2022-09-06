import { QuadSet } from '../collections/data-set.js'
import { Prefixers, randomBlankNode, variable } from '../data-factory.js'
import {
  DEFAULT_GRAPH,
  Literal,
  NamedNode,
  Object,
  Quad,
  Subject,
  Triple,
} from '../term.js'
import { ParseError, unwrap } from './common.js'
import { Lexer, NoMoreTokens } from './lexer.js'
import { Namespace } from './namespace.js'

type Place = keyof Triple | 'list' | 'done'

type Context = [Partial<Quad>, Place]

const { fpc, rdf } = Prefixers

export class Parser {
  namespace = new Namespace()

  lexer: Lexer
  token: string = ''

  context: Context = [{ graph: DEFAULT_GRAPH }, 'subject']

  stack: Context[] = []
  reificationStack: Context[] = []

  result = new QuadSet('GSPO')
  resultAry: Quad[] = []

  constructor(public source: string) {
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
    this.setContext({ predicate: rdf('rest') }, 'list')
  }

  protected addResult(quad: Partial<Quad> = {}): void {
    const mutate = (q: Quad) => {
      this.result.add(q)
      this.resultAry.push({ ...q })
    }

    this.setContext({ ...this.quad, ...quad }, 'done')

    const rContext = this.reificationStack.pop()
    if (!rContext) {
      mutate(this.quad as Quad)
      return
    }

    // reified case
    const bnode = randomBlankNode()
    mutate({ ...rContext[0], object: bnode } as Quad)
    const pattern = { graph: rContext[0].graph!, subject: bnode }
    let type
    if (this.quad.graph === rContext[0].graph) type = rdf('Statement')
    else {
      type = fpc('Pattern')
      mutate({ ...pattern, predicate: fpc('graph'), object: this.quad.graph! })
    }
    mutate({ ...pattern, predicate: rdf('type'), object: type })
    for (const p of ['subject', 'predicate', 'object'])
      mutate({ ...pattern, predicate: rdf(p), object: this.quad[p]! })
    this.reificationStack.push(rContext)
  }

  protected advance(): void {
    this.lexer.advance()
    this.token = this.lexer.token
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
      if (e instanceof NoMoreTokens) return this.result
      throw e
    }
  }

  protected parseDone(): void {
    switch (this.token) {
      case ']':
      case ')':
      case '}':
        this.pop()
        break
      case '>>':
        this.context = this.reificationStack.pop()!
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
        this.setContext({ subject: first }, 'predicate')
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
        this.push('done')
        const bnode = randomBlankNode()
        this.addResult({ object: bnode })
        this.setContext({ subject: bnode }, 'predicate')
        break
      case '(':
        this.push('done')
        this.place = 'list'
        break
      case '<<':
        this.reificationStack.push([{ ...(this.quad as Quad) }, 'done'])
        this.place = 'subject'
        break
      default:
        this.addResult({ object: this.makeObject() })
    }
  }

  protected parsePredicate(): void {
    switch (this.token) {
      case '{':
        this.push('done')
        this.setContext({ graph: this.quad.subject! }, 'subject')
        break
      case 'a':
        this.setContext({ predicate: rdf('type') }, 'object')
        break
      default:
        this.setContext({ predicate: this.namedNode() }, 'object')
    }
  }

  protected parseSubject(): void {
    switch (this.token) {
      case 'base':
        this.advance()
        this.namespace.base = unwrap(this.token)
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
        this.push('done')
        this.setContext({ subject: randomBlankNode() }, 'predicate')
        break
      case '[]':
        this.setContext({ subject: randomBlankNode() }, 'predicate')
        break
      case '(':
        throw this.unexpected()
      case '()':
        this.setContext({ subject: rdf('nil') }, 'predicate')
        break
      case '<<':
      case '+':
      case '-':
        throw this.unexpected()
      default:
        if (this.isLiteral()) throw this.unexpected()
        this.setContext({ subject: this.makeSubject() }, 'predicate')
    }
  }

  protected get place(): Place {
    return this.context[1]
  }

  protected set place(p: Place) {
    this.context[1] = p
  }

  protected pop(): void {
    if (this.stack.length === 0) throw this.unexpected()
    const [quad, place] = this.stack.pop()!
    this.quad = quad
    this.place = place
  }

  protected push(place: Place = this.place): void {
    // this this how i actually call this? :
    // place = (this.place === 'list' ? 'list' : 'done')
    // ditto reificationStack
    this.stack.push([{ ...this.quad }, place])
  }

  protected get quad(): Partial<Quad> {
    return this.context[0]
  }

  protected set quad(q: Partial<Quad>) {
    this.context[0] = q
  }

  protected setContext(q: Partial<Quad>, place: string): void {
    for (const k in q) this.quad[k] = q[k]
    this.place = place
  }

  protected unexpected(): ParseError {
    return new ParseError(`unexpected: ${this.token} @ ${this.place}`)
  }
}
