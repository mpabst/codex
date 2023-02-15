import { CurlyDataSet } from './collections/data-set.js'
import { Index } from './collections/index.js'
import { PREFIXES } from './data-factory.js'
import { Branch, Leaf } from './operations.js'
import { Argument, Bindings, Instruction, Program } from './processor.js'
import {
  BlankNode,
  FlatQuad,
  NamedNode,
  Predicate,
  Subject,
  Term,
  Triple,
  TRIPLE_PLACES,
} from './term.js'

const prefixes: { [k: string]: string } = {}
for (const [abbrev, url] of Object.entries(PREFIXES)) prefixes[url] = abbrev

function abbreviate(s: string, max: number = 20): string {
  if (s.length <= max) return s
  const half = Math.floor((max - 1) / 2)
  return `${s.slice(0, half)}…${s.slice(-half)}`
}

export function formatInstruction([op, left, right]: Instruction): string {
  const width = 25
  const formatArg = (a: Argument): string => {
    let out: string
    if (a === null) out = ''
    else if (a instanceof CurlyDataSet) out = prefixify(a.parent!.name)
    else if (a instanceof NamedNode) out = prefixify(a)
    else out = a!.toString()
    if (out.length > width) out = abbreviate(out)
    return out.padEnd(width)
  }
  return `${op.name.padEnd(16)} ${formatArg(left)} ${formatArg(right)}`
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

export function prefixify({ value }: Term, extraPrefixes = {}): string {
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

type Effect<T> = (arg: T) => void

export class Printer {
  static spacesPerLevel = 2

  #buf = ''
  #indent = ''
  #level = 0

  constructor(public effect: Effect<string> = console.log) {}

  get level(): number {
    return this.#level
  }

  set level(l: number) {
    this.#level = l
    for (let i = 0; i < this.#level * Printer.spacesPerLevel; i++)
      this.#indent += ' '
  }

  indent(): void {
    this.level++
  }

  outdent(): void {
    this.level--
  }

  send(...args: (Term | string)[]): void {
    for (const arg of args)
      if (arg instanceof Term) this.send(prefixify(arg))
      else
        for (const char of arg)
          if (char === '\n') {
            this.effect(this.#buf)
            this.#buf = this.#indent
          } else this.#buf += char
  }
}

export class IndexPrinter extends Printer {
  floaters = new Set<BlankNode>()
  printed = new Set<BlankNode>()
  spo: Branch

  constructor(
    public index: Index,
    public effect: Effect<string> = console.log,
  ) {
    super(effect)
    this.spo = this.index.getRoot('SPO')
  }

  printPredicate(pred: Predicate, os: Term[], i: number): void {
    this.send(pred, os.length > 1 ? '\n' : ' ')
    os.forEach((o, i) => {
      if (!(o instanceof BlankNode) || this.printed.has(o)) this.send(o)
      else {
        this.printed.add(o)
        this.floaters.delete(o)
        this.send(`[ ${o}\n`)
        this.printSubject(o)
        this.send(']')
      }
      if (i < os.length - 1) this.send(' ,\n')
    })
    if (i < po.length - 1) this.send(' ;\n')
  }

  printSubject(subj: Subject): void {
    if (!this.spo.has(subj)) return
    const po = [...this.spo.get(subj)!]
    if (this.level === 0) this.send(subj, po.length > 1 ? '\n' : ' ')
    this.indent()
    ;([...po] as [Term, Set<Term>][]).forEach(([pred, os], i) =>
      this.printPredicate(pred, [...os], i),
    )
    if (this.level === 0) this.send(' .\n')
    this.outdent()
  }
}
