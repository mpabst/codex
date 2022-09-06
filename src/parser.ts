import { QuadSet } from './collections/data-set'
import { literal, namedNode, randomBlankNode } from './data-factory'
import {
  BlankNode,
  DEFAULT_GRAPH,
  Literal,
  NamedNode,
  Object,
  Quad,
  Triple,
} from './term'

const escaper = '\\'

// const delims = '. ; , | { } [ ] << >>'.split(' ')

const quotes: { [k: string]: string } = {
  "'": "'",
  '"': '"',
  '<': '>',
}

// todo: quotes vs groupers

class Lexer {
  token: string = ''
  escape: boolean = false
  quoting: string | null = null
  pos: number = 0

  constructor(public source: string) {
    this.advance()
  }

  advance(): void {
    this.token = ''
    for (; this.pos < this.source.length; this.pos++) {
      const char = this.source[this.pos]

      if (char === escaper) {
        this.escape = true
        continue
      }

      this.token += char

      if (this.escape) this.escape = false
      else if (this.quoting) {
        if (char === quotes[this.quoting]) this.quoting = null
      } else if (char in quotes && this.token === '') this.quoting = char
      else if (/\w/.test(char) && this.token !== '') return
    }
    throw new NoMoreTokens()
  }
}

class NoMoreTokens {}

class ParseError extends Error {}

type Place = keyof Triple | 'list' | 'done'

type Context = [Partial<Quad>, Place]

function rdf(suffix: string): NamedNode {
  return namedNode(`http://www.w3.org/1999/02/22-rdf-syntax-ns#${suffix}`)
}

function unwrap(s: string): string {
  return s.slice(1, -1)
}

class Parser {
  base: string = ''
  prefixes: { [k: string]: string } = {}

  lexer: Lexer
  token: string = ''

  context: Context = [{ graph: DEFAULT_GRAPH }, 'subject']

  stack: Context[] = []

  listTail: NamedNode | BlankNode | null = null

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

  protected addResult(q: Partial<Quad> = {}): void {
    this.setContext(q, 'done')
    this.result.add(this.quad as Quad)
    this.resultAry.push({ ...(this.quad as Quad) })
  }

  protected advance(): void {
    this.token = this.peek
    this.lexer.advance()
  }

  protected isLiteral(): boolean {
    return (
      /^[+-\d'"]/.test(this.token) || ['true', 'false'].includes(this.token)
    )
  }

  protected literal(): Literal {
    return literal(this.token)
  }

  protected namedNode(): NamedNode {
    if (this.token[0] === '<') {
      // absolute URL
      if (/<\w+:/.test(this.token)) return namedNode(this.unwrap())
      return namedNode(this.base + this.unwrap())
    }
    const [prefix, suffix] = this.token.split(':')
    if (!suffix) throw this.unexpected()
    return namedNode(this.prefixes[prefix] + suffix)
  }

  protected nextTokens(n: number): string[] {
    const out = [this.peek]
    for (; n - 1 > 0; n--) {
      this.lexer.advance()
      out.push(this.peek)
    }
    return out
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
    this.addResult()
    switch (this.token) {
      case ']':
        this.pop()
        break
      case ')':
        this.pop()
        break
      case '}':
        this.pop()
        break
      case '|':

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
      default:
        this.addListNode(this.isLiteral() ? this.literal() : this.namedNode())
    }
  }

  protected parseObject(): void {
    switch (this.token) {
      case '[':
        this.push()
        const bnode = randomBlankNode()
        this.addResult({ object: bnode })
        this.setContext({ subject: bnode }, 'predicate')
        break
      case '(':
        this.push()
        this.place = 'list'
        break
      case '<<':
        throw this.unexpected()
      default:
        this.addResult({
          object: this.isLiteral() ? this.literal() : this.namedNode(),
        })
    }
  }

  protected parsePredicate(): void {
    switch (this.token) {
      case '{':
        this.setContext({ graph: this.quad.subject! }, 'subject')
        break
      case 'a':
        this.setContext({ predicate: rdf('type') }, 'object')
      default:
        this.setContext({ predicate: this.namedNode() }, 'object')
    }
  }

  protected parseSubject(): void {
    switch (this.token) {
      case 'base':
        this.lexer.advance()
        this.base = this.unwrap()
        this.place = 'done'
        break
      case 'prefix':
        const [k, v] = this.nextTokens(2)
        this.prefixes[k] = this.unwrap()
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
      default:
        if (this.isLiteral()) throw this.unexpected()
        this.setContext({ subject: this.namedNode() }, 'predicate')
    }
  }

  protected get place(): Place {
    return this.context[1]
  }

  protected set place(p: Place) {
    this.context[1] = p
  }

  protected get peek(): string {
    return this.lexer.token
  }

  protected pop(): void {
    if (this.stack.length === 0) throw this.unexpected()
    const [quad, place] = this.stack.pop()!
    this.quad = quad
    this.place = place
  }

  protected push(place: Place = this.place): void {
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

  protected unwrap(): string {
    return unwrap(this.token)
  }
}
