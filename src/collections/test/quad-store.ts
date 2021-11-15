// import { literal as lit, namedNode as nn } from '../../data-factory.js'
// import { DEFAULT_GRAPH, FlatQuad } from '../../term.js'
// import { ORDERS, QuadStore } from '../quad-store.js'

// const { expect: x } = chai

// function getQuads(): FlatQuad[] {
//   return [
//     [nn('urn:subj'), nn('urn:pred'), lit(1), DEFAULT_GRAPH],
//     [nn('urn:subj'), nn('urn:pred'), lit(2), DEFAULT_GRAPH],
//     [nn('urn:subj3'), nn('urn:pred'), lit(3), nn('urn:graph1')],
//     [nn('urn:subj'), nn('urn:pred4'), lit(4), nn('urn:graph1')],
//     [nn('urn:subj5'), nn('urn:pred5'), lit(5), nn('urn:graph2')]
//   ]
// }

// describe('QuadStore', () => {
//   it('ORDERS', () => {
//     x(ORDERS).eql([
//       'SPOG',
//       'SOPG',
//       'PSOG',
//       'POSG',
//       'OSPG',
//       'OPSG',
//       'GSPO'
//     ])
//   })

//   it('match()', () => {
//     const qs = new QuadStore()
//     const quads = getQuads()
//     quads.forEach(t => qs.add(t))

//     const m1 = qs.match([nn('urn:subj'), null, null])
//     x(m1).eql([quads[0], quads[1], quads[3]])

//     const m2 = qs.match([nn('urn:subj3'), nn('urn:pred'), null])
//     x(m2).eql([quads[2]])

//     const m3 = qs.match([nn('urn:subj3'), nn('urn:pred'), lit(5)])
//     x(m3).eql([])

//     const m4 = qs.match([null, nn('urn:pred5'), lit(5)])
//     x(m4).eql([quads[4]])

//     x(qs.match([null, nn('urn:pred5'), null])).eql([quads[4]])

//     x(qs.match([null, nn('urn:pred6'), null])).eql([])

//     x(qs.match(quads[0])).eql([quads[0]])
//     x(qs.match([null, null, null])).deep.members(quads)
//   })

//   it('remove()', () => {
//     const qs = new QuadStore()
//     const quads = getQuads()
//     quads.forEach(q => qs.add(q))
//     qs.remove(quads[0])
//     x(qs.has(quads[0])).not.ok
//     quads.slice(1).forEach(t => x(qs.has(t)).ok)

//     const m1 = qs.match([nn('urn:subj'), null, null])
//     x(m1).eql([quads[1], quads[3]])

//     const m2 = qs.match([nn('urn:subj3'), nn('urn:pred'), null])
//     x(m2).eql([quads[2]])

//     const m3 = qs.match([nn('urn:subj3'), nn('urn:pred'), lit(5)])
//     x(m3).eql([])

//     const m4 = qs.match([null, nn('urn:pred5'), lit(5)])
//     x(m4).eql([quads[4]])

//     x(qs.match([null, nn('urn:pred5'), null])).eql([quads[4]])

//     x(qs.match([null, nn('urn:pred6'), null])).eql([])

//     x(qs.match(quads[0])).eql([])
//     x(qs.match([null, null, null])).deep.members(quads.slice(1))
//   })
// })
