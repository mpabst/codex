import { Clause } from '../clause.js'
import { Index } from '../collections/index.js'
import { randomVariable } from '../data-factory.js'
import { operations } from '../operations.js'
import { Instruction, Operation, Program } from '../machine.js'
import { Mode, traverse, VarMap } from '../syntax.js'
import { Name, Quad, Term, Variable } from '../term.js'
import { Module } from '../module.js'

abstract class Block {
  abstract mode: Mode
  abstract setOp: Operation

  constructor(
    protected context: Context,
    protected varMap: VarMap,
    public patterns: Quad[],
  ) {}

  add(pattern: Quad): void {
    this.patterns.push(pattern)
  }

  abstract generate(): Program

  protected doPattern(pattern: Quad): Program {
    const program: Program = []
    const order = this.orderTerms(pattern)

    program.push([this.setOp, this.context])
    for (const i in order)
      program.push(this.doTerm(order[i], i === '2' ? 'final' : 'medial'))

    return program
  }

  protected doTerm(
    term: Term | null,
    position: 'medial' | 'final',
  ): Instruction {
    let op: string
    if (term instanceof Variable) {
      if (term.value === '_') {
        op = 'AnonVar'
        term = null
      } else {
        let mapped = this.varMap.get(term)
        if (mapped) op = 'OldVar'
        else {
          op = 'NewVar'
          mapped = randomVariable(term)
          this.varMap.set(term, mapped)
        }
        term = mapped
      }
    } else op = 'Const'
    return [operations[position + this.mode + op], term]
  }

  protected orderPatterns(): Quad[] {
    return this.patterns
  }

  protected orderTerms(pattern: Quad): Term[] {
    return [pattern.subject, pattern.predicate, pattern.object]
  }
}

class EBlock extends Block {
  mode: Mode = 'E'
  setOp = operations.setIndex

  constructor(context: Context, varMap: VarMap, patterns: Quad[] = []) {
    super(context, varMap, patterns)
  }

  generate(): Program {
    return this.orderPatterns().flatMap(p => this.doPattern(p))
  }
}

class IBlock extends Block {
  mode: Mode = 'I'
  setOp = operations.setClause
  protected post: EBlock

  constructor(context: Clause, varMap: VarMap) {
    super(context, varMap, [])
    this.post = new EBlock(context, varMap, this.patterns)
  }

  generate(): Program {
    return [
      ...this.orderPatterns().flatMap(p => this.doPattern(p)),
      [operations.call, null],
      ...this.post.generate(),
    ]
  }
}

function orderBlocks(blocks: Iterable<Block>): Iterable<Block> {
  return blocks
}

export function ask(
  context: Module,
  source: Name | null,
): [Program, VarMap] {
  // For bodiless rules
  if (!source) return [[[operations.emitResult, null]], new Map()]

  const varMap: VarMap = new Map()

  function pattern(node: Name): void {
    // build quad
    // get options for 
  }

  traverse(source, { pattern })

  const program: Program = []
  for (const block of orderBlocks(blocks.values()))
    program.push(...block.generate())
  program.push([operations.emitResult, null])

  return [program, varMap]
}
