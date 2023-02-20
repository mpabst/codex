import { until } from 'lit-html/directives/until.js'
import { customElement, property } from 'lit/decorators.js'
import { css, html, LitElement } from 'lit/index.js'
import { TripleSet } from '../collections/data-set.js'

import { Prefixers } from '../data-factory.js'
import { prefixify } from '../debug.js'
import { Store } from '../store.js'
import { Term, Triple, TRIPLE_PLACES } from '../term.js'

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
    return until(
      this.facts().then(
        f => html`<fp-triple-table .triples=${f.data.get('SPO')} />`,
      ),
    )
  }
}

@customElement('fp-triple-table')
export class TripleTable extends LitElement {
  static styles = css`
    table {
      padding-left: 3rem;
    }

    th {
      font-size: large;
      padding-bottom: 0.2rem;
      border-bottom: 1px solid grey;
    }

    tr.alternate {
      background-color: lightgray;
    }

    td {
      padding: 0.2rem;
    }
  `

  @property()
  triples?: TripleSet

  lastSubject?: Term
  alternate = true

  render() {
    if (!this.triples) return html`no data`
    return html`
      <table>
        <thead>
          <tr>
            ${TRIPLE_PLACES.map(p => html`<th>${p}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${this.triples.map(t => this.renderTriple(t))}
        </tbody>
      </table>
    `
  }

  renderTriple(t: Triple) {
    const { subject } = t
    let first = false
    if (subject !== this.lastSubject) {
      this.alternate = !this.alternate
      this.lastSubject = subject
      first = true
    }
    const [s, p, o] = TRIPLE_PLACES.map(p => prefixify(t[p]))

    return html`<tr class=${this.alternate ? 'alternate' : ''}>
      ${ first ? html`<td id="${s}">${s}</td>` : html`<td>${s}</td>` }
      <td>${p}</td>
      <td><a href="#${o}">${o}</td>
    </tr>`
  }
}
