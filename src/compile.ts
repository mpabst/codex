import { Clause } from './clause.js'
import { Index } from './collections/index.js'
import { randomVariable } from './data-factory.js'
import { operations } from './operations.js'
import { Instruction, Operation, Program } from './query.js'
import { Key, Store } from './store.js'
import { Expression, Pattern, traverse, VarMap } from './syntax.js'
import { Quad, Term, Variable } from './term.js'

// diff quads searching bodies
// - same instructions, pass body index to setIndex
// - what abt variable graph terms? how to restrict? the first thing
// to come to mind is to restrict it by what's already been bound
// - it's an in-var only, so it has to have had associated values. what if that
// set of values changes during push eval?
// how about
// - if bind to var graph, set aside. check other diff stmts first. if it's
// still unchecked afterwards, see if graph is in already fetched set. if yes,
// check, if not, discard

// new calls:
// emit instructions to bind in-args, then 'repeat' call with more instructions
// to dig through callee memo. first phase can skip caller vars which must be
// out-args, rather than in-args or bound to consts in callee head. second phase
// just uses the EDB instructions

// matches data against queries
export function push() {}

type Mode = 'E' | 'I'

abstract class Block {
  abstract mode: Mode
  abstract setOp: Operation

  constructor(
    protected context: Clause | Index,
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

  constructor(context: Index, varMap: VarMap, patterns: Quad[] = []) {
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
    this.post = new EBlock(context.memo, varMap, this.patterns)
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
export function pull(
  store: Store,
  source: Expression<Quad> | null,
): [Program, VarMap] {
  // For bodiless rules
  if (!source) return [[[operations.emitResult, null]], new Map()]

  const blocks = new Map<Clause | Index, Block>()
  const varMap: VarMap = new Map()

  function pattern({ terms }: Pattern<Quad>): void {
    const context = store.get(terms.graph as Key) as Clause | Index
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
