import { Term, Variable } from '../term.js'
import { TripleSet } from './data-set.js'

export class VTSet extends Set<Term> {
  varKeys = new Set<Variable>()

  add(t: Term): this {
    super.add(t)
    if (t.termType === 'Variable') this.varKeys.add(t as Variable)
    return this
  }

  delete(t: Term): boolean {
    if (t.termType === 'Variable') this.varKeys.delete(t as Variable)
    return super.delete(t)
  }
}

export class VTMap extends Map<Term, VTMap | VTSet> {
  varKeys = new Set<Variable>()

  set(key: Term, val: VTMap | VTSet): this {
    super.set(key, val)
    if (key.termType === 'Variable') this.varKeys.add(key as Variable)
    return this
  }

  delete(key: Term): boolean {
    if (key.termType === 'Variable') this.varKeys.delete(key as Variable)
    return super.delete(key)
  }
}

export class VTTripleSet extends TripleSet {
  protected Branch = VTMap
  protected Leaf = VTSet
}
