import { customElement, property, state } from 'lit/decorators.js'
import { css, html, nothing } from 'lit/index.js'
import { TripleSet } from '../collections/data-set.js'

import { prefix, unprefix } from '../debug.js'
import { Name, Term, Triple, TRIPLE_PLACES } from '../term.js'
import { env } from './environment.js'
import { View } from './view.js'

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

  @state()
  triples?: TripleSet

  lastSubject?: Term
  alternate = true

  private _graph?: Name

  @property({ converter: { fromAttribute: unprefix, toAttribute: prefix } })
  get graph(): Name | undefined {
    return this._graph
  }

  set graph(n: Name | undefined) {
    if (n === this._graph) return
    const old = this._graph
    if (n)
      env
        .load(n)
        .then(m => {
          const old = this.triples
          this.triples = m.facts.data.get('SPO')
          this.requestUpdate('triples', old)
        })
        .catch(console.error)
    this._graph = n
    this.requestUpdate('graph', old)
  }

  render() {
    if (!this.triples) return 'no data'
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
    const [s, p, o] = TRIPLE_PLACES.map(p => prefix(t[p]))

    return html`<tr class=${this.alternate ? 'alternate' : nothing}>
      ${first ? html`<td id="${s}">${s}</td>` : html`<td>${s}</td>`}
      <td>${p}</td>
      <td><a href="#${o}">${o}</td>
    </tr>`
  }
}
