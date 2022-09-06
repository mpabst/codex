import { Parser } from '../parser.js'

describe('parser', () => {
  it('parses', () => {
    const parser = new Parser(`
      base <https://fingerpaint.systems/apps/todo> .
      prefix : <#> .
      prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

      :foo :has ( [ a :Bar ; :baz ( :inner :list ) ] ) .
    `)
    parser.parse()
    console.log(parser.namespace.prettyPrint(parser.resultAry))
  })
})
