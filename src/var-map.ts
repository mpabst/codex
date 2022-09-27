import { Variable } from './term.js'

// put this in query.ts ?
export class VarMap {
  constructor(public vars: Variable[] = []) {}

  map(v: Variable): [number, boolean] {
    const i = this.vars.indexOf(v)
    if (i === -1) {
      this.vars.push(v)
      return [this.vars.length - 1, true]
    }
    return [i, false]
  }

  get size(): number {
    return this.vars.length
  }
}
