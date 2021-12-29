import {
  A,
  graph,
  defaultGraph,
  literal as lit,
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
    let createTodo = graph(nn(base), ({ b, p, rq, ass, conj }) => {
      const head = b()
      p(
        todo('createTodo'),
        // [A, fpc('Mutator')],
        [
          fpc('head'),
          [
            ass(head, [A, todo('Todo')]),
            ass(head, [rdfs('label'), vari('l')])
          ],
        ],
        // [
        //   fpc('body'),
        //   conj(rq(fpc('system'), fpc('tick'), [rdfs('label'), vari('l')])),
        // ],
      )
    })
    console.log(createTodo)
  })
})
