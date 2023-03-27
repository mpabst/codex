import { customElement, property } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { Module } from '../module.js'
import { BlankNode, Object, Predicate, Subject } from '../term.js'
import { getProp } from './helpers.js'
import './term.js'
import { View } from './view.js'

@customElement('fp-property')
class PropertyView extends View {
  static styles = View.styles

  @property()
  module?: Module
  @property()
  resource?: Subject
  @property()
  property?: Predicate

  render() {
    if (!this.module || !this.resource || !this.property) return
    const objs = [
      ...(getProp(this.module, this.resource, this.property) ?? new Set()),
    ]

    let contents
    if (!objs.length) contents = html`<span class="none">(none)</span>`
    else if (objs.length === 1 && !(objs[0] instanceof BlankNode))
      contents = html`<fp-term
        property=${this.property!.value}
        .module=${this.module}
        .term=${objs[0]}
      />`
    else contents = this.renderMultiple(objs)
    // prettier-ignore
    return html`<div>
      <fp-term .module=${this.module} .term=${this.property} />
      ${contents}
    </div>`
  }

  renderMultiple(objs: Object[]) {
    const items = []
    for (const o of objs)
      items.push(html`<li><fp-term .module=${this.module} .term=${o} /></li>`)
    return html`<ul rel=${this.property!.value}>
      ${items}
    </ul>`
  }
}
