const { A, g, defaultGraph, literal: lit, Prefixers } = await import('./data-factory.js')

const { fps } = Prefixers

console.log(g(defaultGraph(), ({ b, l }) => l(b([A, fps('Thingy')], [fps('prop'), lit(4)]))))
