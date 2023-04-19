import { blankNode, variable } from '../data-factory.js'
import { BlankNode, Variable } from '../term.js'
import { Parser } from './parser.js'

export class DebugParser extends Parser {
  anonIndex = 0

  blankNode(): BlankNode {
    this.anonIndex++
    return blankNode(this.anonIndex.toString())
  }

  variable(): Variable {
    this.anonIndex++
    return variable(this.anonIndex.toString())
  }
}
