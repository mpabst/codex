import { literal as l, namedNode as nn } from '../../data-factory.js'
import { Triple } from '../../term.js'
import { TripleSet } from '../data-set.js'

const { expect: x } = chai

function tri(s: string, p: string, o: number): Triple {
  return { subject: nn(s), predicate: nn(p), object: l(o) }
}

describe('TripleSet', () => {
  describe('add()', () => {
    it('basic', () => {
      const ts = new TripleSet('SPO')
      ts.add(tri('s1', 'p1', 1))
      ts.add(tri('s1', 'p2', 2))
      ts.add(tri('s2', 'p1', 3))
      x(ts.root).eql(
        new Map([
          [
            nn('s1'),
            new Map([
              [nn('p1'), new Set([l(1)])],
              [nn('p2'), new Set([l(2)])],
            ]),
          ],
          [nn('s2'), new Map([[nn('p1'), new Set([l(3)])]])],
        ]),
      )
      x(ts.size).eql(3)
    })

    it('reordering', () => {
      const ts = new TripleSet('PSO')
      ts.add(tri('s1', 'p1', 1))
      ts.add(tri('s1', 'p2', 2))
      ts.add(tri('s2', 'p1', 3))
      x(ts.root).eql(
        new Map([
          [
            nn('p1'),
            new Map([
              [nn('s1'), new Set([l(1)])],
              [nn('s2'), new Set([l(3)])],
            ]),
          ],
          [nn('p2'), new Map([[nn('s1'), new Set([l(2)])]])],
        ]),
      )
      x(ts.size).eql(3)
    })
  })

  it('delete()', () => {
    const ts = new TripleSet('SPO')
    ts.add(tri('s1', 'p1', 1))
    ts.add(tri('s1', 'p2', 2))
    ts.add(tri('s2', 'p1', 3))
    ts.delete(tri('s1', 'p2', 2))
    x(ts.root).eql(
      new Map([
        [nn('s1'), new Map([[nn('p1'), new Set([l(1)])]])],
        [nn('s2'), new Map([[nn('p1'), new Set([l(3)])]])],
      ]),
    )
    x(ts.size).eql(2)
  })
})
