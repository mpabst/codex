import { TupleMultiSet, add } from './collections/tuple-multi-set.js'
import { Bindings } from './query.js'
import { Head, Pattern, traverse } from './syntax.js'
import { Term, Triple, Variable } from './term.js'

type Operation = (b: Bindings, term: Term) => Term
type Program = [Operation, Term][]

export class Generator {
  program: [Operation, ...any][]

  constructor(protected memo: TupleMultiSet<Term>, source: Head) {
    this.program = compile(source)
  }

  generate(bindings: Bindings): void {
    for (let pc = 0; pc < this.program.length; pc += 3)
      add(this.memo, [
        this.program[pc][0](bindings, this.program[pc][1]),
        this.program[pc + 1][0](bindings, this.program[pc + 1][1]),
        this.program[pc + 2][0](bindings, this.program[pc + 2][1]),
      ])
  }
}

function compile(source: Head): Program {
  const program: Program = []
  traverse(source, {
    pattern({ terms: { subject, predicate, object } }: Pattern<Triple>): void {
      for (const term of [subject, predicate, object])
        program.push([
          operations[term.termType === 'Variable' ? 'var' : 'const'],
          term,
        ])
    },
  })
  return program
}

// flatten bindings at start of generate()?
function deref(b: Bindings, v: Variable): Term {
  let found: Term
  while (true) {
    found = b.get(v)!
    // we can assume everything is bound by the time we're
    // generating, so no v !== found check
    if (found.termType === 'Variable') v = found as Variable
    else break
  }
  return found
}

const operations: { [k: string]: Operation } = {
  const(_: Bindings, t: Term): Term {
    return t
  },

  var(b: Bindings, v: Term): Term {
    return deref(b, v as Variable)
  },
}
