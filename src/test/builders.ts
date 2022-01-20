import { A, Prefixers, prefixer, builders } from '../builders.js'
import { namedNode } from '../data-factory.js'

const base = 'https://fingerpaint.systems/apps/todo'

const { rdfs, fpc, html } = Prefixers
const todo = prefixer(base + '#')
const graph = namedNode(base)

const { g, add, l, b, r, v, clause, rule } = builders

describe('builders', () => {
  it('', () => {
    console.log(g(
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
    ).unwrap())
  })
  debugger
})
