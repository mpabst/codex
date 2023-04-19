import { TripleSet } from '../../collections/data-set.js'
import { Index } from '../../collections/index.js'
import { namedNode, Prefixers } from '../../data-factory.js'
import { DebugParser } from '../debug.js'
import { Parser } from '../parser.js'

const { test } = Prefixers

describe('parser', () => {
  it('basic', () => {
    const mod = test('basic')
    const src = `
    
    
    `
  })

  it.only('rules', () => {
    const append = test('append')
    const src = `
      prefix : <#> .
      prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      prefix fpc: <https://fingerpaint.systems/core/> .

      <#> a fpc:Rule ;
        fpc:clause [
          fpc:head { [ a :Appending ] } ;
          fpc:body { [ a :Appending ] }
        ] .
    `
    const parser = new DebugParser(append, src)
    parser.parse(new Index(append, TripleSet))
    console.log(parser.namespace.prettyPrint(parser.resultAry))
  })

  it('parses', () => {
    const todo = namedNode('https://fingerpaint.systems/apps/todo')
    const parser = new Parser(
      todo,
      `
      prefix : <#> .
      prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      prefix fpc: <https://fingerpaint.systems/core/> .

      :markDone a fpc:Writer ;
        fpc:clause [
          fpc:assert { ?graph { ?todo :done true ; :when :now } } ;
          fpc:retract { ?graph { ?todo :done false } } ;
          fpc:body { ?graph { ?todo a :Todo } }
        ] .
    `,
    )

    parser.parse(new Index(todo, TripleSet))
    console.log(parser.namespace.prettyPrint(parser.resultAry))
  })
})
