import { customElement, property } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { TripleSet } from '../collections/data-set.js'

import { prefixify } from '../debug.js'
import { Term, Triple, TRIPLE_PLACES } from '../term.js'
import View from './view.js'

@customElement('fp-triple-table')
export class TripleTable extends View {
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
      ${first ? html`<td id="${s}">${s}</td>` : html`<td>${s}</td>`}
      <td>${p}</td>
      <td><a href="#${o}">${o}</td>
    </tr>`
  }
}
