import { namedNode } from '../data-factory.js'
import { Term } from '../term'

export const termConverter = {
  fromAttribute: (value: string) => namedNode(value),
  toAttribute: ({ value }: Term) => value,
}
