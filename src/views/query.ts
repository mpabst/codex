import { customElement, property } from 'lit/decorators.js'
import { css, html, PropertyValueMap } from 'lit/index.js'
import { prefixify } from '../debug.js'
import { Argument, Instruction } from '../processor.js'
import { Query } from '../query.js'
import { Term } from '../term.js'
import View from './view.js'

@customElement('fp-query')
export default class QueryView extends View {
  static styles = css`
    .current {
      background-color: dodgerblue;
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
          ${this.query.program.map((instr, i) => this.renderInstruction(instr, i))}
        </tbody>
      </table>
    `
  }

  renderArg(a: Argument) {
    if (!a) return
    if (a instanceof Term) return prefixify(a)
    return a
  }

  renderInstruction(instr: Instruction, i: number) {
    const klass = i === this.programP ? 'current' : ''
    return html`<tr class=${klass}>
      <td>${i}</td>
      <td>${instr[0].name}</td>
      <td>${this.renderArg(instr[1])}</td>
      <td>${this.renderArg(instr[2])}</td>
    </tr>`
  }

  protected shouldUpdate(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): boolean {
    return super.shouldUpdate(_changedProperties)
  }
}
