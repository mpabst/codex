import { MultiIndex } from './collections/index.js'
import { Bindings } from './query.js'
import { Head, Pattern, traverse } from './syntax.js'
import { Object, Predicate, Subject, Term, Triple, Variable } from './term.js'

type Operation = (b: Bindings, term: Term) => Term
type Instruction = [Operation, Term]
type Program = Instruction[]

export class Generator {
  program: Instruction[]

  constructor(protected memo: MultiIndex, source: Head) {
    this.program = compile(source)
  }

  generate(bindings: Bindings): void {
    const process = ([op, arg]: Instruction): Term => op(bindings, arg)
    for (let pc = 0; pc < this.program.length; pc += 3)
      this.memo.add({
        subject: process(this.program[pc]) as Subject,
        predicate: process(this.program[pc + 1]) as Predicate,
        object: process(this.program[pc + 2]) as Object,
      })
  }
}

function compile(source: Head): Program {
  const program: Program = []
  traverse(source, {
    pattern({ terms: { subject, predicate, object } }: Pattern<Triple>): void {
      for (const term of [subject, predicate, object])
        program.push([
          operations[term instanceof Variable ? 'var' : 'const'],
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
    if (found instanceof Variable) v = found
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
