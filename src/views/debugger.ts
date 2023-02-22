import { customElement, property, state } from 'lit/decorators.js'
import { css, html, PropertyValues } from 'lit/index.js'
import { TripleSet } from '../collections/data-set.js'
import { Index } from '../collections/index.js'

import { Prefixers } from '../data-factory.js'
import { TopLevel } from '../query.js'
import { Store } from '../store.js'
import './processor.js'
import './triple-table.js'
import View from './view.js'

const { fpc, test } = Prefixers

@customElement('fp-debugger')
export class Debugger extends View {
  static styles = css`
    .container {
      display: flex;
    }
  `

  @property()
  graph?: string

  @state()
  facts?: Index<TripleSet>

  store = new Store()
  protected toRefresh = ['fp-processor']

  async fetchModule() {
    if (!this.graph) return

    const node = test(this.graph)
    if (!this.store.modules.has(node)) await this.store.load(node)
    const mod = this.store.modules.get(node)!
    this.facts = mod.facts

    // FIXME: just hardcode which query for now
    const [body] = mod.facts
      .getRoot('SPO')
      .get(test('append#query'))!
      .get(fpc('body'))

    this.store.proc.query = new TopLevel(mod, body)

    this.refresh()
  }

  render() {
    return html`<fp-processor .proc=${this.store.proc} />`
  }

  renderFacts() {
    if (!this.facts) return
    return html`<fp-triple-table .triples=${this.facts.data.get('SPO')} />`
  }

  willUpdate(changed: PropertyValues<this>) {
    if (changed.has('graph') || (this.graph && !this.facts)) this.fetchModule()
  }
}
