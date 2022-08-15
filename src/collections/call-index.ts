import { Bindings, Query } from '../query'
import { Term } from '../term'

interface TrackedBindings {
  allBindings: Bindings
  // so we can look up the call the generated these
  // bindings and GC it from a CallTracker. could
  // maybe also attach callee Bindings when we notify
  // callers, so when they try to rederive their calls
  // they can update callees' call trackers
  inArgs: Bindings
}

export type CallTracker = [Set<Query>, Set<Bindings>]
export type CallIndex = Map<Term, CallIndex | CallTracker>

function newCallTracker(): CallTracker {
  return [new Set(), new Set()]
}

export function map(branch: CallIndex, path: Term[]): CallTracker {
  let next
  for (const p of path.slice(0, -1)) {
    next = branch.get(p) as CallIndex
    if (!next) {
      next = new Map()
      branch.set(p, next)
    }
    branch = next
  }
  const last = path[path.length - 1]
  let out = branch.get(last)
  if (!out) {
    out = newCallTracker()
    branch.set(last, out)
  }
  return out as CallTracker
}
