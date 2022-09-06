import { QuadSet } from './collections/data-set.js'
import {
  literal,
  namedNode,
  randomBlankNode,
  variable,
} from './data-factory.js'
import {
  BlankNode,
  DEFAULT_GRAPH,
  Literal,
  NamedNode,
  Object,
  Quad,
  Subject,
  Term,
  Triple,
} from './term.js'

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

  constructor(public source: string) {}

  advance(): void {
    this.token = ''
    for (; this.pos < this.source.length; this.pos++) {
      const char = this.source[this.pos]

      if (char === escaper) {
        this.escape = true
        continue
      }

      if (/\s/.test(char)) {
        if (this.token !== '') return
        else continue
      }

      this.token += char

      if (this.escape) this.escape = false
      else if (this.quoting) {
        if (char === quotes[this.quoting]) this.quoting = null
      } else if (char in quotes && this.token === '') this.quoting = char
    }
    throw new NoMoreTokens()
  }
}

class NoMoreTokens {}

class ParseError extends Error {}

type Place = keyof Triple | 'list' | 'done'

type Context = [Partial<Quad>, Place]

function fpc(suffix: string): NamedNode {
  return namedNode(`https://fingerpaint.systems/core/${suffix}`)
}

function rdf(suffix: string): NamedNode {
  return namedNode(`http://www.w3.org/1999/02/22-rdf-syntax-ns#${suffix}`)
}

function unwrap(s: string): string {
  return s.slice(1, -1)
}

class Namespace {
  base: string = ''
  prefixes: { [k: string]: string } = {}

  namedNode(token: string): NamedNode {
    if (token[0] === '<') {
      // absolute URL
      if (/<\w+:/.test(token)) return namedNode(unwrap(token))
      return namedNode(this.base + unwrap(token))
    }
    const [prefix, suffix] = token.split(':')
    if (!suffix) throw new ParseError(`could not parse named node: ${token}`)
    return namedNode(this.prefixes[prefix] + suffix)
  }

  format(term: Term): string {
    if (!(term instanceof NamedNode)) return term.toString()
    for (const [k, v] of Object.entries(this.prefixes))
      if (term.value.startsWith(v)) return `${k}:${term.value.slice(v.length)}`
    return term.toString()
  }

  prettyPrint(quads: Quad[]): string[][] {
    const out: string[][] = []
    for (const q of quads)
      out.push(
        [q.graph, q.subject, q.predicate, q.object].map(t => this.format(t)),
      )
    return out
  }
}

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
    return literal(this.token)
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
