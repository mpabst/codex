import { A, g } from '../builders.js'
import {
  variable as vari,
  namedNode as nn,
  Prefixers,
  prefixer,
} from '../data-factory.js'

const base = 'https://fingerpaint.systems/apps/todo'
const todo = prefixer(base + '#')
const { fpc, html, rdfs } = Prefixers

describe('builders', () => {
  it('', () => {
    let createTodo = g(nn(base), ({ b, p, r }) => {
      p(
        todo('createTodo'),
        [A, fpc('Writer')],
        [
          fpc('head'),
          r(({ ass }) => ass(b(), [A, todo('Todo')], [rdfs('label'), vari('label')])),
        ],
        [
          fpc('body'),
          r(({ g }) =>
            g(fpc('system'), ({ p }) =>
              p(fpc('tick'), [rdfs('label'), vari('label')]),
            ),
          ),
        ],
      )
    })

    let TodoView = g(nn(base), ({ p, and, r, b }) => {
      p(
        todo('TodoView'),
        [A, fpc('View')],
        [
          fpc('head'),
          r(({ p, l }) => {
            p(
              b(),
              [A, html('li')],
              [html('children'), l(p(b(), [html('text'), vari('label')]))],
            )
          }),
        ],
        [
          fpc('body'),
          and(
            ...r(({ p }) =>
              p(
                vari('todo'),
                [A, todo('Todo')],
                [rdfs('label'), vari('label')],
              ),
            ),
          ),
        ],
      )
    })
    console.log(TodoView)
  })
})
