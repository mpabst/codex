import { customElement, property } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { Prefixers } from '../data-factory.js'
import { getProps, mapList } from '../helpers.js'
import { Module } from '../module.js'
import { A, BlankNode, Term } from '../term.js'
import './property-list.js'
import './term.js'
import { View } from './view.js'

const { fpc, rdf } = Prefixers

@customElement('fp-blank-node')
class BlankNodeView extends View {
  @property()
  module!: Module
  @property()
  resource!: BlankNode

  render() {
    const types = getProps(this.module, this.resource).get(A)

    if (types.has(rdf('List'))) return this.renderList()

    if ([rdf('Statement'), fpc('Pattern')].some(t => types.has(t)))
      return this.renderStatement()

    return html`<fp-property-list
      .module=${this.module}
      .resource=${this.resource}
    />`
  }

  renderList() {
    return html`
      <ol>
        ${mapList(
          this.module,
          this.resource,
          (t: Term) => html`<fp-object .module=${this.module} .term=${t} />`,
        )}
      </ol>
    `
  }

  renderStatement() {
    return 'renderStatement()'
  }
}
