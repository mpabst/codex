import { LitElement } from 'lit/index.js'

export default abstract class View extends LitElement {
  protected toRefresh: string[] = []

  // protected createRenderRoot(): Element | ShadowRoot {
  //   return this
  // }

  refresh() {
    this.requestUpdate()
    for (const s of this.toRefresh) {
      const elem = this.renderRoot.querySelector(s)
      if (elem) (elem as View).refresh()
    }
  }
}