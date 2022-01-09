import { A, g } from '../builders.js'
import {
  variable as vari,
  namedNode as nn,
  PREFIXES,
  Prefixers,
  prefixer,
} from '../data-factory.js'
import { BlankNode, FlatQuad, NamedNode, turtle } from '../term.js'

const base = 'https://fingerpaint.systems/apps/todo'
const todo = prefixer(base + '#')
const { fpc, html, rdfs } = Prefixers

function format({ value }: NamedNode | BlankNode): string {
  const prefixes = Object.entries(PREFIXES).concat([
    ['todo', base + '#'],
    ['_', '_:https://fingerpaint.systems/apps/todo#_'],
  ])
  for (const [p, url] of prefixes)
    if (value.startsWith(url)) return value.replace(url, p + ':')
  return value
}

function formatQuads(quads: FlatQuad[]): string {
  const out: string[] = []
  for (const q of quads) {
    const row = []
    for (const t of [q[0], q[1], q[2]])
      if (t.termType === 'NamedNode' || t.termType === 'BlankNode')
        row.push(format(t))
      else row.push(t.value.toString())
    out.push(row.join(' '))
  }
  return out.join('\n')
}

describe('builders', () => {
  it('', () => {
    let createTodo = g(nn(base), ({ b, p, r }) => {
      p(
        todo('createTodo'),
        [A, fpc('Writer')],
        [
          fpc('head'),
          r(({ ass }) =>
            ass(b(), [A, todo('Todo')], [rdfs('label'), vari('label')]),
          ),
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
              vari('li'),
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
    console.log(formatQuads(TodoView))
  })
})
