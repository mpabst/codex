import { consume } from '@lit-labs/context'
import { customElement, property, state } from 'lit/decorators.js'
import { css, html, nothing } from 'lit/index.js'
import { Branch } from '../collections/data-set.js'
import { getProps } from '../helpers.js'
import {
  Literal,
  NamedNode,
  Object,
  Predicate,
  Subject,
  Variable,
} from '../term.js'
import { spoContext } from './environment.js'
import './term.js'
import { View } from './view.js'

@customElement('fp-property')
class PropertyView extends View {
  static styles = [
    View.styles,
    css`
      ul {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .indent {
        margin: 0.5rem 0 0.5rem 0.5rem;
      }

      .inline {
        display: inline;
      }
    `,
  ]

  @property()
  resource!: Subject

  @property()
  property!: Predicate

  @consume({ context: spoContext() })
  @state()
  declare spo: Branch

  render() {
    const objs = [...getProps(this.spo, this.resource).get(this.property)]
    let contents
    let inline = false

    if (!objs.length) {
      contents = html`<span class="none">(none)</span>`
      inline = true
    } else if (objs.length === 1) {
      contents = html`<fp-term
        property=${this.property.value}
        .term=${objs[0]}
      ></fp-term>`
      if ([Literal, NamedNode, Variable].some(k => objs[0] instanceof k))
        inline = true
    } else contents = this.renderMultiple(objs)

    return html`
      <fp-term .term=${this.property} part="prop-name"></fp-term>
      <div class=${inline ? 'inline' : 'indent'}>${contents}</div>
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
