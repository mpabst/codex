import { customElement, property } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { Module } from '../module.js'
import { Subject } from '../term.js'
import { getProps } from '../helpers.js'
import './property.js'
import { View } from './view.js'

@customElement('fp-property-list')
class PropertyListView extends View {
  static styles = View.styles

  @property()
  module!: Module
  @property()
  resource!: Subject

  render() {
    const props = getProps(this.module, this.resource)

    const items = []
    for (const p of props.data.keys())
      items.push(html`<li>
        <fp-property
          .module=${this.module}
          .resource=${this.resource}
          .property=${p}
        />
      </li>`)

    return items.length > 0
      ? html`
          <ul>
            ${items}
          </ul>
        `
      : 'no data'
  }
}
