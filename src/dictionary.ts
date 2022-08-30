import { DEFAULT_GRAPH, Term } from './term.js'

abstract class Dictionary<T> {
  protected readonly data = new Map<string, T>()

  clear(): void {
    this.data.clear()
  }

  abstract key(t: T): string

  lookup(t: T): T {
    const key = this.key(t)
    const found = this.data.get(key)
    if (!found) this.data.set(key, t)
    return found || t
  }
}

export class TermDictionary extends Dictionary<Term> {
  constructor() {
    super()
    this.lookup(DEFAULT_GRAPH)
  }

  clear(): void {
    super.clear()
    this.lookup(DEFAULT_GRAPH)
  }

  key(t: Term): string {
    return t.toString()
  }
}
