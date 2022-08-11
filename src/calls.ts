// call instructions:
// constant: choose through [correct value] + [...callee vars]

import { Query } from './query.js'
import { Term } from './term.js'

function pushChoicePoint(it: Iterator<Term>): ChoicePoint {
  const out = new ChoicePoint(this.instructionPtr, this.clause, this.dbNode, it)
  this.stack.push(out)
  return out
}

function inferredConstant(
  query: Query,
  term: Argument,
  advanceNode: Operation,
  declaredConstant: Operation,
): void {
  if (query.dbNode!.varKeys.size > 0) {
    declaredConstant(query, term)
    return
  }

  let choicePoint = query.stack[query.stack.length - 1]
  if (!choicePoint || choicePoint.instructionPtr !== query.instructionPtr)
    choicePoint = query.pushChoicePoint(query.dbNode!.varKeys.values())

  const result = choicePoint.iterator?.next()!
  if (result.done) {
    query.calleeBindings.set(
      choicePoint.calleeBinding,
      choicePoint.calleeBinding,
    )
    query.stack.pop()
    declaredConstant(query, term)
  } else {
    const ultimate = deref(query.calleeBindings, result.value)
    if (ultimate.termType === 'Variable') {
      query.calleeBindings.set(ultimate, term)
      choicePoint.calleeBinding = ultimate
      advanceNode(query, result.value)
      query.instructionPtr++
    } else if (ultimate === term) query.instructionPtr++
    else query.fail = true
  }
}

function inferredNewVariable(query: Query, term: Argument) {
  let choicePoint = query.stack[query.stack.length - 1]

  if (!choicePoint || choicePoint.instructionPtr !== query.instructionPtr)
    choicePoint = query.pushChoicePoint(query.dbNode!.keys())

  if (choicePoint.calleeBinding)
    query.calleeBindings.set(
      choicePoint.calleeBinding,
      choicePoint.calleeBinding,
    )

  const result = choicePoint.iterator?.next()!

  if (result.done) {
    query.bindings.set(term as Variable, term as Term)
    query.stack.pop()
    query.fail = true
    return
  }

  query.bindings.set(term as Variable, result.value)
  if (result.value.termType === 'Variable') {
    const ultimate = deref(query.calleeBindings, result.value)
    if (ultimate.termType === 'Variable') {
      query.calleeBindings.set(ultimate, term)
      choicePoint.calleeBinding = ultimate
      query.bindings.set(term, result.value)
      advanceNode(query, result.value)
      query.instructionPtr++
    } else if (ultimate === term) {
      advanceNode(query, result.value)
      query.instructionPtr++
    } else query.fail = true
    return
  }

  query.bindings.set(term, result.value)
  advanceNode(query, result.value)
  query.instructionPtr++
}

function inferredOldVariable(query: Query, term: Argument): void {}

// new variable: choose through all callee values
// seen var: as constant, with deref

// caller vars: bind as usu, to proximal deref
// ditto arg mapping, at call time, do full deref

// call:
// deref args (copy), Query.evaluate(), collect result bindings, choose through, mapping back to caller vars

// backtracking needs to undo callee arg mapping

// we need the trail back, too, because with collecting calls, we'll need to undo more than one
// var on backtracking

// push onto array on CP

// second array for callee arg mappings. it can just be a scalar.
