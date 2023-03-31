import { consume } from '@lit-labs/context'
import { customElement, property, state } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { Branch } from '../collections/data-set.js'
import { getProps } from '../helpers.js'
import { Subject } from '../term.js'
import { spoContext } from './environment.js'
import './property.js'
import { View } from './view.js'

@customElement('fp-property-list')
class PropertyListView extends View {
  static styles = [
    View.styles,
    css`
      fp-property {
        display: block;
      }

      fp-property::part(prop-name) {
        display: inline-block;
        width: 50%;
      }
    `,
  ]

  @property()
  declare resource: Subject

  @consume({ context: spoContext() })
  @state()
  declare spo: Branch

  render() {
    const props = getProps(this.spo, this.resource)

    const items = []
    for (const p of props.data.keys())
      items.push(html`<li>
        <fp-property .resource=${this.resource} .property=${p} />
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
