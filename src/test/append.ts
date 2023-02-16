import { until } from 'lit-html/directives/until.js'
import { customElement } from 'lit/decorators.js'
import { css, html, LitElement } from 'lit/index.js'

import { Prefixers } from '../data-factory.js'
import { Store } from '../store.js'

const { test } = Prefixers

@customElement('fp-test')
export class Test extends LitElement {
  static styles = css`
    h1 {
      font-style: italic;
    }
  `

  store = new Store()
  node = test('append')

  async facts() {
    await this.store.load(this.node)
    return this.store.modules.get(this.node)!.facts
  }

  render() {
    return until(this.facts().then(f => html`${f.getRoot('SPO').size}`))
  }
}
