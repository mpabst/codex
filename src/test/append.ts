import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('fp-test')
export class Test extends LitElement {
  static styles = css`h1 { font-style: italic; }`

  @property()
  text = ''

  render() {
    return html`<h1>${this.text}</h1>`
  }
}
