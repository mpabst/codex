import { consume } from '@lit-labs/context'
import { customElement, property, state } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { getProps } from '../helpers.js'
import { Subject } from '../term.js'
import { envContext, EnvironmentView } from './environment.js'
import './property.js'
import { View } from './view.js'

@customElement('fp-property-list')
class PropertyListView extends View {
  static styles = View.styles

  @property()
  declare resource: Subject

  @consume({ context: envContext() })
  @state()
  declare env: EnvironmentView

  render() {
    const props = getProps(this.env.module!, this.resource)

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
