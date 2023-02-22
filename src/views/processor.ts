import { customElement, property } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { prefixify } from '../debug.js'

import { Processor } from '../processor.js'
import { Term, TRIPLE_PLACES } from '../term.js'
import './query.js'
import View from './view.js'

@customElement('fp-processor')
export default class ProcessorView extends View {
  static styles = css`
    .container {
      display: grid;
      grid-template-columns: 10rem calc(100vw - 10rem);
      grid-template-rows: 100vh;
      grid-template-areas: 'globals query';
    }

    .globals {
      grid-area: globals;
      display: flex;
      flex-direction: column;
    }

    .globals tr {
      text-align: left;
    }

    .globals th {
      font-weight: normal;
    }

    .globals td {
      font-weight: bold;
    }

    fp-query {
      overflow-y: auto;
      grid-area: query;
      width: min-content;
    }
  `

  @property({ attribute: false })
  proc = new Processor()

  protected toRefresh = ['fp-query']

  render() {
    return html`<section class="container">
      ${this.renderGlobals()}
      <fp-query .query=${this.proc.query} .programP=${this.proc.programP} />
      ${this.renderHeap()}
    </section>`
  }

  renderGlobals() {
    return html`
      <table class="globals">
        <tr>
          <th>direction:</th>
          <td>${this.proc.direction}</td>
        </tr>
        <tr>
          <th>fail:</th>
          <td>${this.proc.fail}</td>
        </tr>
        ${TRIPLE_PLACES.map(
          p => html`
            <tr>
              <th>${p}:</th>
              <td>${prefixify(this.proc.triple[p])}</td>
            </tr>
          `,
        )}
      </table>
    `
  }

  renderHeap() {
    return html`
      <table>
        <tbody>
          ${this.proc.heap.map((h, i) => this.renderHeapCell(h, i))}
        </tbody>
      </table>
    `
  }

  renderHeapCell(value: Term | number, i: number) {
    return html`
      <tr>
        <td>${i}</td>
        <td>${value instanceof Term ? prefixify(value) : value}</td>
      </tr>
    `
  }
}
