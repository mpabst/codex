import {add, TupleSet, remove} from '../tuple-set.js'

const {expect: x} = chai

describe('TupleSet', () => {
  it('add()', () => {
    const ts: TupleSet<number> = new Map()
    add(ts, [1, 2, 3])
    add(ts, [1, 4, 5])
    add(ts, [6, 7, 8])
    x(ts).eql(
      new Map([
        [
          1,
          new Map([
            [2, new Set([3])],
            [4, new Set([5])],
          ]),
        ],
        [6, new Map([[7, new Set([8])]])],
      ]),
    )
  })

  it('remove()', () => {
    const ts: TupleSet<number> = new Map()
    add(ts, [1, 2, 3])
    add(ts, [1, 4, 5])
    add(ts, [6, 7, 8])
    remove(ts, [1, 4, 5])
    x(ts).eql(
      new Map([
        [1, new Map([[2, new Set([3])]])],
        [6, new Map([[7, new Set([8])]])],
      ]),
    )
  })
})
