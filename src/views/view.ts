import { css, CSSResultGroup, LitElement } from 'lit/index.js'

export abstract class View extends LitElement {
  static styles: CSSResultGroup = css`
    ul {
      list-style-type: none;
      margin-block-start: 0;
      margin-block-end: 0;
      padding-inline-start: 0;
    }
  `

  protected toRefresh: string[] = []

  refresh() {
    this.requestUpdate()
    for (const s of this.toRefresh) {
      const elem = this.renderRoot.querySelector(s)
      if (elem) (elem as View).refresh()
    }
  }
}
