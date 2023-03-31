import { consume, provide } from '@lit-labs/context'
import { customElement, property, state } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { Branch } from '../collections/data-set.js'
import { Subject } from '../term.js'
import { envContext, EnvironmentView, spoContext } from './environment.js'
import { termConverter } from './helpers.js'
import './property-list.js'
import { View } from './view.js'

@customElement('fp-resource')
class ResourceView extends View {
  static styles = [
    View.styles,
    css`
      section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
    `,
  ]

  @property({ converter: termConverter })
  declare resource: Subject

  @provide({context: spoContext() })
  @property({ attribute: false })
  declare spo: Branch

  @consume({ context: envContext() })
  @state()
  declare env: EnvironmentView

  render() {
    if (!this.resource) return
    return html`
      <section>
        <header>${this.env.formatName(this.resource)}</header>
        <fp-property-list .resource=${this.resource}></fp-property-list>
      </section>
    `
  }
}
