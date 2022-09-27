import { A, ANON_VAR, DEFAULT_GRAPH, Term } from './term.js'

abstract class Dictionary<T> {
  protected readonly data = new Map<string, T>()

  constructor() {
    this.init()
  }

  clear(): void {
    this.data.clear()
    this.init()
  }

  protected abstract init(): void

  abstract key(t: T): string

  lookup(t: T): T {
    const key = this.key(t)
    const found = this.data.get(key)
    if (!found) this.data.set(key, t)
    return found || t
  }
}

export class TermDictionary extends Dictionary<Term> {
  protected init(): void {
    for (const c of [A, ANON_VAR, DEFAULT_GRAPH]) this.lookup(c)
  }

  key(t: Term): string {
    return t.toString()
  }
}
