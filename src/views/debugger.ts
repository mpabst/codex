import { until } from 'lit-html/directives/until.js'
import { customElement, property } from 'lit/decorators.js'
import { css, html, LitElement } from 'lit/index.js'

import { Prefixers } from '../data-factory.js'
import { Store } from '../store.js'
import './triple-table.js'

const { test } = Prefixers

@customElement('fp-debugger')
export class Debugger extends LitElement {
  static styles = css`
    h1 {
      font-style: italic;
    }
  `

  @property()
  graph?: string

  store = new Store()

  async facts() {
    if (!this.graph) return
    const node = test(this.graph)
    await this.store.load(node)
    return this.store.modules.get(node)!.facts
  }

  render() {
    return until(
      this.facts().then(
        f => f && html`<fp-triple-table .triples=${f.data.get('SPO')} />`,
      ),
    )
  }
}
