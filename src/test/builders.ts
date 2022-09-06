import {A, Prefixers, prefixer, builders} from '../builders.js'
import {namedNode} from '../data-factory.js'

const base = 'https://fingerpaint.systems/apps/todo'

const {rdfs, fpc, html} = Prefixers
const todo = prefixer(base + '#')
const graph = namedNode(base)

const {g, add, l, b, r, v, clause, rule} = builders

describe('builders', () => {
  it('', () => {
    ;[g, todo, [
        todo.createTodo,
        A, fpc.Rule,
        fpc.clause, [
          b, A, fpc.Clause,
          fpc.head, [ass,
              b, A, todo.Todo,
                rdfs.label,
                v.label ],
          fpc.body, [r,
            g, fpc.system, [
              fpc.tick, rdfs.label, v.label ] ]
        ]
      ],
      todo.TodoView,
        A, fpc.Rule,
        fpc.clause, [b, 
          A, fpc.View,
          fpc.head, [r, ]
        ]
    ]

    ;`
        base <https://fingerpaint.systems/apps/todo> .
        prefix : <#> .
        prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        prefix fpc: <https://fingerpaint.systems/core#> .
        prefix html: <https://fingerpaint.systems/core/html#> .

        :createTodo a fpc:Writer ;
          fpc:clause [
            fpc:head << + { [ a :Todo ; rdfs:label ?label ] } >> ;
            fpc:body << fpc:system { fpc:tick rdfs:label ?label } >>
          ] .

        :todoView a fpc:View ;
          fpc:clause [
            fpc:head << ?li a html:LI ; html:children ( [ a html:text ; html:value ?label ] ) >> ;
            fpc:body << ?todo a :Todo ; rdfs:label ?label >>
          ] .

        :createTodo a fpc:Writer ;
          fpc:clause {
            + [ a :Todo ; rdfs:label ?label ]
          } :- { 
            fpc:system { fpc:tick rdfs:label ?label } 
          } .

        :todoView a fpc:View ;
          fpc:clause @h( li ?label ) :- { ?_ a :Todo ; rdfs:label ?label } .
`

    console.log(
      g(
        graph,
        rule(
          todo.createTodo,
          clause(
            fpc.Writer,
            add(b(A, todo.Todo, rdfs.label, v.label)),
            r(g(fpc.system, fpc.tick(rdfs.label, v.label))),
          ),
        ),
        rule(
          todo.TodoView,
          clause(
            fpc.View,
            r(v.li.h(html.li, v.label)),
            r(v.todo(A, todo.Todo, rdfs.label, v.label)),
          ),
        ),
      ).unwrap(),
    )
  })
})
