import { MultiIndex } from './collections/index.js'
import { randomVariable } from './data-factory.js'
import { Bindings } from './query.js'
import { Head, Pattern, traverse, VarMap } from './syntax.js'
import { Object, Predicate, Subject, Term, Triple, Variable } from './term.js'

type Operation = (b: Bindings, term: Term) => Term
type Instruction = [Operation, Term]

export class Generator {
  program: Instruction[] = []
  protected varNames: VarMap

  constructor(
    protected memo: MultiIndex,
    protected source: Head,
    varNames: VarMap,
  ) {
    this.varNames = new Map(varNames)
    traverse(this.source, { pattern: this.compilePattern })
  }

  protected compilePattern = ({ terms }: Pattern<Triple>): void => {
    const { subject, predicate, object } = terms
    for (const term of [subject, predicate, object])
      this.program.push(
        term instanceof Variable
          ? [ops.var, this.varName(term)]
          : [ops.const, term],
      )
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

  protected varName(v: Variable): Variable {
    let found = this.varNames.get(v)
    if (!found) {
      found = randomVariable(v)
      this.varNames.set(v, found)
    }
    return found
  }
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

const ops: { [k: string]: Operation } = {
  const(_: Bindings, t: Term): Term {
    return t
  },

  var(b: Bindings, v: Term): Term {
    return deref(b, v as Term)
  },
}
