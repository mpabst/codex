// const {
//   A,
//   g,
//   defaultGraph,
//   literal: lit,
//   variable: vari,
//   namedNode: nn,
//   Prefixers,
//   prefixer,
// } = await import('./data-factory.js')

// const { fps } = Prefixers

// const base = 'https://fingerpaint.systems/apps/todo'
// const todo = prefixer(base + '#')
// const { fpc, html, rdfs } = Prefixers

// let createTodo = g(nn(base), ({ b, l, s, r }) => {
//   r(b([A, todo('Todo')], [rdfs('label'), vari('l')]))
// })

//   s(todo('createTodo'),
//     [A, fpc('Mutator')],
//     [fpc('head'), ]
//   )
// })



// console.log(
//   g(defaultGraph(), ({ b, l }) =>
//     l(b([A, fps('Thingy')], [fps('prop'), lit(4)]))
//   )
// )