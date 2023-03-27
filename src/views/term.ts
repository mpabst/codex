import { customElement, property } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { prefix } from '../debug.js'
import { Module } from '../module.js'
import { BlankNode, Literal, NamedNode, Term } from '../term.js'
import './blank-node.js'
import { formatName } from './helpers.js'
import { View } from './view.js'

@customElement('fp-term')
class TermView extends View {
  @property()
  module!: Module
  @property()
  term!: Term

  render() {
    switch (this.term.constructor) {
      case Literal:
        return this.term.value
      case NamedNode:
        return this.module
          ? formatName(this.module, this.term)
          : prefix(this.term)
      case BlankNode:
        return html`<fp-blank-node
          .module=${this.module}
          .resource=${this.term}
        />`
      default:
        throw new Error(`unhandled term type: ${this.term.constructor.name}`)
    }
  }
}
