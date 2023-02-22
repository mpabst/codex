import { customElement, property } from 'lit/decorators.js'
import { css, html, nothing } from 'lit/index.js'
import { formatArg } from '../debug.js'
import { Instruction } from '../processor.js'
import { Query } from '../query.js'
import View from './view.js'

@customElement('fp-query')
export default class QueryView extends View {
  static styles = css`
    .current {
      background-color: dodgerblue;
      color: white;
    }
  `

  @property()
  programP: number = -1
  @property({ attribute: false })
  query?: Query

  render() {
    if (!this.query) return
    return html`
      <table class="program">
        <tbody>
          ${this.query.program.map((instr, i) =>
            this.renderInstruction(instr, i),
          )}
        </tbody>
      </table>
    `
  }

  renderInstruction(instr: Instruction, i: number) {
    return html`<tr class=${i === this.programP ? 'current' : nothing}>
      <td>${i}</td>
      <td>${instr[0].name}</td>
      <td>${formatArg(instr[1])}</td>
      <td>${formatArg(instr[2])}</td>
    </tr>`
  }
}
