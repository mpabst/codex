import { customElement, property } from 'lit/decorators.js'
import { css, html, PropertyValueMap } from 'lit/index.js'
import { prefixify } from '../debug.js'
import { Argument, Instruction } from '../processor.js'
import { Query } from '../query.js'
import { Term } from '../term.js'
import View from './view.js'

@customElement('fp-query')
export default class QueryView extends View {
  static styles = css``

  @property({ attribute: false })
  query?: Query

  render() {
    if (!this.query) return
    return html`
      <table class="program">
        <tbody>
          ${this.query.program.map(i => this.renderInstruction(i))}
        </tbody>
      </table>
    `
  }

  renderArg(a: Argument) {
    if (!a) return
    if (a instanceof Term) return prefixify(a)
    return a
  }

  renderInstruction(i: Instruction) {
    return html`<tr>
      <td>${i[0].name}</td>
      <td>${this.renderArg(i[1])}</td>
      <td>${this.renderArg(i[2])}</td>
    </tr>`
  }

  protected shouldUpdate(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): boolean {
    return super.shouldUpdate(_changedProperties)
  }
}
