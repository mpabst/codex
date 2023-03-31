import { provide } from '@lit-labs/context'
import { html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators'
import { Branch } from '../collections/data-set'
import { spoContext } from './environment'

@customElement('fp-triple-context')
class TripleContext extends LitElement {
  @provide({ context: spoContext() })
  @property()
  declare spo: Branch

  render() {
    html`<slot></slot>`
  }
}
