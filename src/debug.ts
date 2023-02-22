import { CurlyDataSet } from './collections/data-set.js'
import { PREFIXES } from './data-factory.js'
import { Argument, Bindings, Instruction, Program } from './processor.js'
import { Query } from './query.js'
import { NamedNode, Triple, TRIPLE_PLACES, Variable } from './term.js'

const prefixes: { [k: string]: string } = {}
for (const [abbrev, url] of Object.entries(PREFIXES)) prefixes[url] = abbrev

function abbreviate(s: string, max: number = 20): string {
  if (s.length <= max) return s
  const half = Math.floor((max - 1) / 2)
  return `${s.slice(0, half)}…${s.slice(-half)}`
}

// offset is a calleeP-relative address
export function calleeVar({ callees }: Query, offset: number): Variable {
  let i = callees.length - 1
  while (callees[i].offset > offset) i--
  return callees[i].target.vars[offset - callees[i].offset]
}

export function formatArg(a: Argument): string {
  if (a === null) return ''
  else if (a instanceof CurlyDataSet) return prefixify(a.parent!.name)
  else if (a instanceof NamedNode) return prefixify(a)
  else return a.toString()
}

export function formatInstruction([op, left, right]: Instruction): string {
  const width = 25
  function arg(a: Argument): string {
    const s = formatArg(a)
    if (s.length > width) return abbreviate(s)
    return s.padEnd(width)
  }
  return `${op.name.padEnd(16)} ${arg(left)} ${arg(right)}`
}

// export function parseProgram(source: string): Program {
//   const parseArg = (a: string): Argument => a[0] === '"' ?

//   const out: Program = []
//   for (const line of source.split('\n')) {
//     // fixme: spaces in quoted strings. use Lexer?
//     const [op, left, right] = line.split(' ')
//     const instr: Partial<Instruction> = []
//     instr.push(operations[op], )
//   }
// }

export function prefixify(arg: Argument, extraPrefixes = {}): string {
  if (arg === null) return ''
  if (!(arg instanceof NamedNode)) return arg.toString()
  const { value } = arg
  for (const [url, abbrev] of Object.entries({ ...prefixes, ...extraPrefixes }))
    if (value.startsWith(url)) return value.replace(url, abbrev + ':')
  return value
}

export function stringifyBindings(bindings: Bindings): string[][] {
  const out = []
  for (const pair of bindings) out.push(pair.map(prefixify))
  return out
}

export function printBindings(bindings: Bindings): void {
  console.log(
    stringifyBindings(bindings)
      .map(o => o.join(': '))
      .join('\n'),
  )
}

export function stringifyTriple(triple: Triple): string[] {
  const out = []
  for (const t of TRIPLE_PLACES) out.push(prefixify(triple[t]))
  return out
}

export function printTriple(triple: Triple): void {
  console.log(stringifyTriple(triple).join(' '))
}

export function printProgram(
  p: Program,
  out: (s: string) => void = console.log,
): void {
  for (let i = 0; i < p.length; i++)
    out(`${i.toString().padEnd(4)} ${formatInstruction(p[i])}`)
}
