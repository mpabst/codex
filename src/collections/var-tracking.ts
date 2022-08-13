import * as defaulting from './defaulting.js'
import { FlatTriple, Term, Variable } from '../term.js'
import { Branch, Index } from './index.js'
import { fillTwig, prune } from './tree.js'

class VTSet extends Set<Term> {
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

type VTBranch = VTMap | VTSet

export class VTMap extends Map<Term, VTBranch> {
  varKeys = new Set<Variable>()

  set(key: Term, val: VTBranch): this {
    super.set(key, val)
    if (key.termType === 'Variable') this.varKeys.add(key as Variable)
    return this
  }

  delete(key: Term): boolean {
    if (key.termType === 'Variable') this.varKeys.delete(key as Variable)
    return super.delete(key)
  }
}

const tupleSet = {
  // args really should be VTBranches, but otherwise getting
  // args missing varKeys, even though neither function here
  // needs it

  add(set: Branch, tuple: Term[]): void {
    fillTwig(set, tuple.slice(0, -1), (b, k) =>
      defaulting.get(b, k, () => new VTSet()),
    ).add(tuple[tuple.length - 1])
  },

  remove(set: Branch, tuple: Term[]): void {
    prune(set, tuple.slice(0, -1), (leaf) => {
      leaf.delete(tuple[tuple.length - 1])
      return leaf.size === 0
    })
  },
}

export class VTIndex extends Index {
  constructor() {
    super(VTMap)
  }
  
  protected addData(index: Branch, data: FlatTriple): void {
    tupleSet.add(index, data)
  }
}
