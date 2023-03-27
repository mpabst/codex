import { consume } from '@lit-labs/context'
import { customElement, property, state } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { getProps } from '../helpers.js'
import { BlankNode, Object, Predicate, Subject } from '../term.js'
import { envContext, EnvironmentView } from './environment.js'
import './term.js'
import { View } from './view.js'

@customElement('fp-property')
class PropertyView extends View {
  static styles = View.styles

  @property()
  resource!: Subject

  @property()
  property!: Predicate

  @consume({ context: envContext() })
  @state()
  declare env: EnvironmentView

  render() {
    const objs = [
      ...getProps(this.env.module!, this.resource).get(this.property),
    ]
    let contents
    if (!objs.length) contents = html`<span class="none">(none)</span>`
    else if (objs.length === 1 && !(objs[0] instanceof BlankNode))
      contents = html`<fp-term
        property=${this.property.value}
        .term=${objs[0]}
      ></fp-term>`
    else contents = this.renderMultiple(objs)
    // prettier-ignore
    return html`
      <fp-term .term=${this.property}></fp-term>
      ${contents}
    `
  }

  renderMultiple(objs: Object[]) {
    const items = []
    for (const o of objs)
      items.push(
        html`<li>
          <fp-term .term=${o}></fp-term>
        </li>`,
      )
    return html`<ul rel=${this.property.value}>
      ${items}
    </ul>`
  }
}
