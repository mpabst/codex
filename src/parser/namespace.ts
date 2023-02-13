import { literal, namedNode, Prefixers } from '../data-factory.js'
import { Literal, NamedNode, Quad, Term } from '../term.js'
import { ParseError, unwrap } from './common.js'
import { ESCAPER } from './lexer.js'

const { xsd } = Prefixers

export class Namespace {
  prefixes: { [k: string]: string } = {}

  constructor(public base: string) {}

  error(type: string, token: string): ParseError {
    return new ParseError(`could not parse ${type} from token: ${token}`)
  }

  format(term: Term): string {
    if (term instanceof NamedNode) return this.qualify(term)
    if (term instanceof Literal) {
      if (term.language !== '') return `"${term.value}"@${term.language}`
      if (['decimal', 'boolean', 'string'].find(t => term.datatype === xsd(t)))
        return term.value
      return `"${term.value}"^^${this.qualify(term.datatype)}`
    }
    return term.toString()
  }

  literal(token: string): Literal {
    // string
    if (token[0] === '"' || token[0] === "'") {
      // no language tag or custom datatype
      if (token[0] === token[token.length - 1]) return literal(unwrap(token))
      let i = 1
      for (; i < token.length; i++)
        if (token[i] === ESCAPER) i++ // skip next char
        else if (token[i] === token[0]) break
      // now i is index of closing quote
      const value = token.slice(1, i)
      // language tag
      if (token[i + 1] === '@') return literal(value, token.slice(i + 2))
      // custom datatype
      if (token.slice(i + 1, i + 2) === '^^')
        return literal(value, this.namedNode(token.slice(i + 3)))
      throw this.error('literal', token)
    }
    // boolean
    if (token === 'true' || token === 'false')
      return literal(token, xsd('boolean'))
    // decimal - todo: leading decimal points?
    if (/[+-\d]/.test(token[0])) return literal(token, xsd('decimal'))
    throw this.error('literal', token)
  }

  namedNode(token: string): NamedNode {
    if (token[0] === '<') {
      // absolute URL
      if (/^<\w+:/.test(token)) return namedNode(unwrap(token))
      // fixme: chop off last path component of base ?
      return namedNode(this.base + unwrap(token))
    }
    const [prefix, suffix] = token.split(':')
    if (!(prefix in this.prefixes))
      throw new ParseError(`unknown prefix: ${prefix}:`)
    return namedNode(this.prefixes[prefix] + suffix)
  }

  prettyPrint(quads: Quad[]): string[][] {
    const out: string[][] = []
    for (const q of quads)
      out.push(
        [q.graph, q.subject, q.predicate, q.object].map(t => this.format(t)),
      )
    return out
  }

  qualify(nn: NamedNode): string {
    let longest: [string | null, string] = [null, '']
    for (const [k, v] of Object.entries(this.prefixes))
      if (nn.value.startsWith(v) && v.length > longest[1].length)
        longest = [k, v]
    if (longest[0] !== null)
      return nn.value.replace(longest[1], longest[0] + ':')
    return nn.toString()
  }
}
