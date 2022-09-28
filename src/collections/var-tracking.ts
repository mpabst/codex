import { Term, Variable } from '../term.js'
import { QuadSet } from './data-set.js'

export class VTSet extends Set<Term> {
  varKeys = new Set<Variable>()

  add(t: Term): this {
    super.add(t)
    if (t instanceof Variable) this.varKeys.add(t)
    return this
  }

  delete(t: Term): boolean {
    if (t instanceof Variable) this.varKeys.delete(t)
    return super.delete(t)
  }
}

export class VTMap extends Map<Term, VTMap | VTSet> {
  varKeys = new Set<Variable>()

  set(key: Term, val: VTMap | VTSet): this {
    super.set(key, val)
    if (key instanceof Variable) this.varKeys.add(key)
    return this
  }

  delete(key: Term): boolean {
    if (key instanceof Variable) this.varKeys.delete(key)
    return super.delete(key)
  }
}

export class VTQuadSet extends QuadSet {
  protected readonly Branch = VTMap
  protected readonly Twig = VTSet

  constructor(order: string = 'GSPO') {
    super(order)
    // have to overwrite this after we set this.Branch
    this.root = new VTMap()
  }
}
