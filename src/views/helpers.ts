import { Branch, Twig } from '../collections/data-set.js'
import { namedNode, Prefixers } from '../data-factory.js'
import { Module } from '../module.js'
import { A, NIL, Object, Predicate, Subject, Term } from '../term.js'

export const termConverter = {
  fromAttribute: (value: string) => namedNode(value),
  toAttribute: ({ value }: Term) => value,
}

const { rdf } = Prefixers

// 'get unitary value'
function getUValue(props: Branch, pred: Predicate): Term {
  return [...(props.get(pred) as Twig)][0]
}

export function isA(module: Module, head: Subject, type: Object): boolean {
  return getProp(module, head, A)?.has(type) ?? false
}

export function mapList<T>(module: Module, head: Subject, cb: (t: Term) => T) {
  const out: T[] = []
  let next = head
  while (next && next !== NIL) {
    const props = getProps(module, next)
    if (!props) break
    out.push(cb(getUValue(props, rdf('first'))))
    next = getUValue(props, rdf('rest'))
  }
  return out
}

export function getProp(
  module: Module,
  resource: Subject,
  property: Predicate,
): Twig | undefined {
  return getProps(module, resource)?.get(property) as Twig
}

export function getProps(
  { subjects }: Module,
  resource: Subject,
): Branch | undefined {
  return subjects.get(resource) as Branch
}
