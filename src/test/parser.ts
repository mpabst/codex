import { Parser } from '../parser.js'

describe('parser', () => {
  it('parses', () => {
    const parser = new Parser(`
      base <https://fingerpaint.systems/apps/todo> .
      prefix : <#> .
      prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

      :foo a rdfs:Bar .
    `)
    parser.parse()
    console.log(parser.resultAry)
  })
})
