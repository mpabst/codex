import { namedNode } from '../data-factory.js'
import { prefix } from '../debug.js'
import { Module } from '../module.js'
import { A, Name, Term } from '../term.js'

export function formatName(module: Module, name: Name): string {
  if (name === A) return 'a'
  return prefix(name).replace(module?.prefix ?? '', '')
}

export const termConverter = {
  fromAttribute: (value: string) => namedNode(value),
  toAttribute: ({ value }: Term) => value,
}
