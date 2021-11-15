import { FlatQuad, Term, Variable } from '../term.js'
import { indexOrder, reorder, Branch, Order, Node, Store } from '../collections/store.js'

const PATTERN_LENGTH = 4

export type Bindings = Map<Variable, Term>

type Conjunction = FlatQuad[]

type Section = 'and' | 'or'

interface ChoicePoint {
  type: 'ChoicePoint'
  choices: Term[]
  nextChoiceP: number // index into choices
  node: Node
  // stackFrame: StackFrame
  variable: Variable
  sectionP: Section
  lineP: number
  termP: number
}
interface OrChoice {
  type: 'OrChoice'
  nextOrP: number
}

// interface StackFrame {
//   lines: Line[]
//   // ip: InstructionPointer
//   bindings: Bindings
// }

interface Line {
  pattern: FlatQuad
  order: Order
}

export interface Query {
  and: Conjunction,
  or: Conjunction[],
}

interface QueryLines {
  and: Line[],
  or: Line[][],
}

function reorderGoals(goals: FlatQuad[]): Line[] {
  const out: Line[] = []
  for (const g of goals) {
    // const order = indexOrder(g)
    // out.push({ pattern: reorder(order, g), order})
    out.push({ pattern: g, order: 'SPOG' })
  }
  return out
}

function reorderQuery(query: Query): QueryLines {
  const out: QueryLines = { and: [], or: [] }
  out.and = reorderGoals(query.and)
  for (const o of query.or) out.or.push(reorderGoals(o))
  return out
}

export function query(
  store: Store,
  query: Query,
  emit: (b: Bindings) => any,
) {
  const goals = reorderQuery(query),
    bindings = new Map<Variable, Term>(),
    trail: (ChoicePoint | OrChoice)[] = []
  let lineP!: number,
    termP!: number,
    sectionP: Section = 'and',
    line!: Line,
    term!: Term,
    node!: Node,
    lines = goals.and

  function initPs() {
    lineP = 0, termP = -1
  }

  function getFrame(): ChoicePoint | OrChoice {
    return trail[trail.length - 1]
  }

  function getValue(): Term | undefined {
    if (term.termType === 'Variable') return bindings.get(term as Variable)
    return term
  }

  function chooseNext(): boolean {
    const frame = getFrame()
    if (frame.type === 'OrChoice') return chooseNextOr(frame)
    if (frame.nextChoiceP === frame.choices.length) return false
    const next = frame.choices[frame.nextChoiceP]
    bindings.set(frame.variable, next)
    frame.nextChoiceP++
    return true
  }

  function chooseNextOr(frame: OrChoice): boolean {
    if (frame.nextOrP === goals.or.length) return false
    else {
      lines = goals.or[frame.nextOrP]
      frame.nextOrP++
      return true
    }
  }

  function pushChoicePoint() {
    const variable = term as Variable
    const choices = Array.from(node instanceof Map ? node.keys() : node)
    trail.push({
      type: 'ChoicePoint',
      choices,
      nextChoiceP: 0,
      variable,
      node,
      lineP,
      termP,
      sectionP,
    })
    chooseNext()
  }

  function pushOrChoicePoint(): boolean {
    if (!goals.or.length) return false
    trail.push({ type: 'OrChoice', nextOrP: 0 })
    initPs()
    chooseNext()
    return true
  }

  function popChoicePoint(): boolean {
    // not zero, because there's no point to popping the first CP
    if (trail.length === 1) return false
    const frame = getFrame()
    switch (frame.type) {
      case 'ChoicePoint':
        bindings.delete(frame.variable)
        break
      case 'OrChoice':
        sectionP = 'and'
        break
    }
    trail.pop()
    return true
  }

  function backtrack(): boolean {
    while (!chooseNext()) {
      if (!popChoicePoint()) return false
    }
    const frame = getFrame()
    if (frame.type === 'OrChoice') initPs()
    else ({ lineP, termP, node } = frame)
    return true
  }

  function advance(): boolean {
    termP++
    if (termP === PATTERN_LENGTH) {
      termP = 0
      lineP++
    }

    if (lineP === lines.length) switch (sectionP) {
      case 'and':
        sectionP = 'or'
        if (pushOrChoicePoint()) return advance()
      case 'or':
        emit(new Map(bindings))
        if (!backtrack()) return false
        break
      // case 'calls':
      //   throw 'TODO'
    }

    line = lines[lineP]
    term = line.pattern[termP]
    if (termP === 0) node = store[line.order]
    return true
  }

  initPs()

  while (advance()) {
    let value = getValue(),
      definitelyThere = false

    if (!value) {
      pushChoicePoint()
      value = getValue()
      definitelyThere = true
    }

    if (node instanceof Set) {
      if (!definitelyThere && !node.has(value!) && !backtrack()) break
    } else {
      const matched = (node as Branch).get(value!)
      if (!matched && !backtrack()) break
      node = matched!
    }
  }
}
