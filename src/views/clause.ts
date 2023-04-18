import { consume } from '@lit-labs/context'
import { customElement, property, state } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { Branch } from '../collections/data-set.js'
import { Prefixers } from '../data-factory.js'
import { getProps } from '../helpers.js'
import { Subject } from '../term.js'
import { spoContext } from './environment.js'
import { termConverter } from './helpers.js'
import { View } from './view.js'

const { fpc } = Prefixers

@customElement('fp-clause')
class ClauseView extends View {
  @property({ converter: termConverter })
  declare resource: Subject

  @consume({ context: spoContext() })
  @state()
  declare spo: Branch

  get body(): Subject {
    return this.props.getUValue(fpc('body'))
  }

  get head(): Subject {
    return this.props.getUValue(fpc('head'))
  }

  get props() {
    return getProps(this.spo, this.resource)
  }

  render() {
    return html`<div>
      <fp-conjunction .resource=${this.head}></fp-conjunction>
      ${this.body &&
      html`
        <div class="arrow">&larr;</div>
        <fp-conjunction .resource=${this.body}></fp-conjunction>
      `}
    </div>`
  }
}
