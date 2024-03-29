import { consume } from '@lit-labs/context'
import { customElement, property, state } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import {
  BlankNode,
  DefaultGraph,
  Literal,
  NamedNode,
  Term,
  Variable,
} from '../term.js'
import './blank-node.js'
import { envContext, EnvironmentView } from './environment.js'
import { View } from './view.js'

@customElement('fp-term')
class TermView extends View {
  @property()
  declare linkHandler: (t: Term) => (ev: Event) => void

  @property()
  declare term: Term

  @consume({ context: envContext() })
  @state()
  declare env: EnvironmentView

  render() {
    if (!this.term) return
    switch (this.term.constructor) {
      case Literal:
        return this.term.value
      case NamedNode:
        return html`<a
          href=${this.term.value}
          @click=${(this.linkHandler ?? this.env.setResource)(this.term)}
        >
          ${this.env.formatName(this.term)}
        </a>`
      case BlankNode:
        return html`<fp-blank-node .resource=${this.term}></fp-blank-node>`
      case DefaultGraph:
        return this.term.toString()
      case Variable:
        if (this.term.value[0] === '_')
          return html`<fp-blank-node .resource=${this.term}></fp-blank-node>`
        else return this.term.toString()
      default:
        throw new Error(`unhandled term type: ${this.term.constructor.name}`)
    }
  }
}
