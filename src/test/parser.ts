import { Parser } from '../parser/parser.js'

describe('parser', () => {
  it('parses', () => {
    const parser = new Parser(`
      base <https://fingerpaint.systems/apps/todo> .
      prefix : <#> .
      prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      prefix fpc: <https://fingerpaint.systems/core/> .

      :markDone a fpc:Writer ;
        fpc:clause [
          fpc:assert << ?graph { ?todo :done true } >> ;
          fpc:retract << ?graph { ?todo :done false } >> ;
          fpc:body << ?graph { ?todo a :Todo } >>
        ] .
    `)
    parser.parse()
    console.log(parser.namespace.prettyPrint(parser.resultAry))
  })
})
