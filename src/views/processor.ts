import { customElement, property } from 'lit/decorators.js'
import { css, html, nothing, TemplateResult } from 'lit/index.js'
import { calleeVar, prefixify } from '../debug.js'

import { Processor } from '../processor.js'
import { Query } from '../query.js'
import { TRIPLE_PLACES, Variable } from '../term.js'
import './query.js'
import View from './view.js'

@customElement('fp-processor')
export default class ProcessorView extends View {
  static styles = css`
    .container {
      display: grid;
      width: calc(100vw - 2rem);
      height: 100vh;
      margin: 0 1rem;
      grid-template-rows: 3rem auto;
      grid-template-columns: 8rem 30rem 20rem;
      grid-template-areas:
        'controls query heap'
        'globals query heap';
      gap: 1rem;
    }

    .controls {
      margin-top: 1rem;
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

    .globals > div.field,
    .globals > div.result > div {
      display: flex;
      justify-content: space-between;
    }

    .globals > div.result {
      flex-direction: column;
    }

    .globals > div.field > div:last-child {
      font-weight: bold;
      text-align: right;
    }

    fp-query {
      overflow-y: auto;
      grid-area: query;
      width: 100%;
    }

    .heap {
      grid-area: heap;
      height: fit-content;
    }
  `

  @property({ attribute: false })
  proc = new Processor()

  protected toRefresh = ['fp-query']

  render() {
    return html`<div class="container">
      ${this.renderControls()} ${this.renderGlobals()}
      <fp-query
        .query=${this.proc.query}
        .programP=${this.proc.programP}
      ></fp-query>
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
      klass: string | typeof nothing = 'field',
    ) => html`<div class="${klass}">
      <div>${name}:</div>
      <div>${val}</div>
    </div>`

    return html`
      <div class="globals">
        ${['fail', 'programP', 'andP', 'orP', 'scopeP', 'envP', 'calleeP'].map(
          f => field(f),
        )}
        <div class="result">
          ${TRIPLE_PLACES.map(p =>
            field(
              p.toString()[0],
              prefixify(this.proc.triple[p] ?? null),
              nothing,
            ),
          )}
        </div>
      </div>
    `
  }

  // TODO: var cells are `label: current bound value`; where label is toString()
  // for named vars, and the heap index (converted from a relative offset if
  // necessary) for random vars
  renderFrame(envP: number, query: Query) {
    const renderHeapCell = (i: number) => {
      const getVar = (): Variable => {
        if (envP === 0) {
          if (i < query.scope.length) return query.scope[i]
          return calleeVar(query, i - query.scope.length)
        }
        return calleeVar(query, i)
      }

      // index, name of var, current value
      return html`
        <tr>
          <td>${i}</td>
          <td>${getVar()}</td>
          <td>${prefixify(this.proc.heap[i])}</td>
        </tr>
      `
    }

    const cells: TemplateResult[] = []
    let limit = query.envSize
    if (envP === 0) limit += query.scope.length
    for (let i = envP; i < limit; i++) cells.push(renderHeapCell(i))

    return html`<tbody>
      ${cells}
    </tbody>`
  }

  renderHeap() {
    return html`
      <table class="heap">
        ${this.proc.callStack.map(frame => this.renderFrame(...frame))}
      </table>
    `
  }

  step() {
    this.proc.step()
    this.refresh()
  }
}
