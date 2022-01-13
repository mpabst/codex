import { g, Prefixers, prefixer, ass, l, b, r, v, and } from '../builders-2.js'
import { A } from '../builders.js'
import { namedNode as nn } from '../data-factory.js'

const { rdfs, fpc, html } = Prefixers
const todo = prefixer('https://fingerpaint.systems/todo#')

const base = 'https://fingerpaint.systems/apps/todo'

describe('builders', () => {
  it('', () => {
    let createTodo = g(
      nn(base),
      todo.createTodo(
        A,
        fpc.Writer,
        fpc.head,
        ass(b(A, todo.Todo, rdfs.label, v.label)),
        fpc.body,
        r(g(fpc.system, fpc.tick(rdfs.label, v.label))),
      ),
    )

    let TodoView = g(
      nn(base),
      todo.TodoView(
        A,
        fpc.View,
        fpc.head,
        r(v.li(A, html.li, html.children, l(b(html.text, v.label)))),
        fpc.body,
        and(r(v.todo(A, todo.Todo, rdfs.label, v.label))),
      ),
    )

    debugger
  })
})
