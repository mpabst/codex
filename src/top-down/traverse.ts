import { Operation } from './syntax'

export function traverse(root: Operation, emit = console.log) {
  let op: Operation | null | undefined = root
  const stack: (Operation | null)[] = []
  while (true) {
    emit(op)
    if (op === null) {
      op = stack.pop()
      if (op === undefined) return
      continue
    }
    switch (op.type) {
      case 'Line':
        op = op.rest
        break
      case 'Conjunction':
      case 'Disjunction':
      case 'Negation':
        stack.push(op.rest)
        op = op.first
        break
    }
  }
}
