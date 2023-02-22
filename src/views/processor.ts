import { customElement, property } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { prefixify } from '../debug.js'

import { Processor } from '../processor.js'
import { Term } from '../term.js'
import './query.js'
import View from './view.js'

@customElement('fp-processor')
export default class ProcessorView extends View {
  static styles = css`
    .container {
      display: flex;
    }
  `

  @property({ attribute: false })
  proc = new Processor()

  protected toRefresh = ['fp-query']

  render() {
    return html`<section class="container">
      <fp-query .query=${this.proc.query} .programP=${this.proc.programP} />
      ${this.renderHeap()}
    </section>`
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
