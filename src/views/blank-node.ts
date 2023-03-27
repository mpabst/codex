import { customElement, property } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { Prefixers } from '../data-factory.js'
import { Module } from '../module.js'
import { A, BlankNode, Term } from '../term.js'
import { getProp, mapList } from './helpers.js'
import './object.js'
import './property-list.js'
import { View } from './view.js'

const { fpc, rdf } = Prefixers

@customElement('fp-blank-node')
class BlankNodeView extends View {
  @property()
  module?: Module
  @property()
  resource?: BlankNode

  render() {
    if (!this.module || !this.resource) return
    const types = getProp(this.module, this.resource, A)
    if (types?.has(rdf('List'))) return this.renderList()
    if ([rdf('Statement'), fpc('Pattern')].some(type => types?.has(type)))
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
          this.module!,
          this.resource!,
          (t: Term) => html`<fp-object .module=${this.module} .term=${t} />`,
        )}
      </ol>
    `
  }

  renderStatement() {
    return 'renderStatement()'
  }
}
