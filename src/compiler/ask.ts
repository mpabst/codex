import { Clause } from '../clause.js'
import { Index } from '../collections/index.js'
import { randomVariable } from '../data-factory.js'
import { operations } from '../operations.js'
import { Instruction, Operation, Program } from '../machine.js'
import { Expression, Mode, Pattern, traverse, VarMap } from '../syntax.js'
import { Node, Quad, Term, Variable } from '../term.js'
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

// solves queries against data
export function ask(
  context: Module,
  source: Node | null,
): [Program, VarMap] {
  // For bodiless rules
  if (!source) return [[[operations.emitResult, null]], new Map()]

  const blocks = new Map<Context, Block>()
  const varMap: VarMap = new Map()

  function pattern(context: Index, pattern: Node): void {
    const context = store.get(terms.graph as Key)!
    let block: Block = blocks.get(context)!
    if (!block) {
      if (context instanceof Clause) block = new IBlock(context, varMap)
      else block = new EBlock(context, varMap)
      blocks.set(context, block)
    }
    block.add(terms)
  }

  traverse(source, { pattern })

  const program: Program = []
  for (const block of orderBlocks(blocks.values()))
    program.push(...block.generate())
  program.push([operations.emitResult, null])

  return [program, varMap]
}
