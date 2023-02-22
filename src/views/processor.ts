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
      grid-template-rows: 2rem calc(100vh - 2rem);
      grid-template-columns: 8rem 40rem 20rem;
      grid-template-areas:
        'controls query heap'
        'globals query heap';
      gap: 1rem;
    }

    .controls {
      grid-area: controls;
    }

    .controls > button {
      width: 100%;
      height: 100%;
    }

    .globals {
      grid-area: globals;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .globals > div {
      display: flex;
      justify-content: space-between;
    }

    .globals > div > div:last-child {
      font-weight: bold;
      text-align: right;
    }

    fp-query {
      overflow-y: auto;
      grid-area: query;
      width: fit-content;
    }

    .heap {
      grid-area: heap;
    }
  `

  @property({ attribute: false })
  proc = new Processor()

  protected toRefresh = ['fp-query']

  render() {
    return html`<div class="container">
      ${this.renderControls()} ${this.renderGlobals()}
      <fp-query .query=${this.proc.query} .programP=${this.proc.programP} />
      ${this.renderHeap()}
    </div>`
  }

  renderControls() {
    return html`<div class="controls">
      <button @click=${() => this.step()}>step</button>
    </div>`
  }

  renderGlobals() {
    const field = (
      name: string | number,
      val: any = (this.proc as any)[name],
    ) => html`<div>
      <div>${name}:</div>
      <div>${val}</div>
    </div>`

    return html`
      <div class="globals">
        ${['fail', 'programP', 'andP', 'orP', 'scopeP', 'envP', 'calleeP'].map(
          f => field(f),
        )}
        ${TRIPLE_PLACES.map(p =>
          field(p, prefixify(this.proc.triple[p] ?? null)),
        )}
      </div>
    `
  }

  renderHeap() {
    return html`
      <table class="heap">
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

  step() {
    this.proc.step()
    this.refresh()
  }
}
