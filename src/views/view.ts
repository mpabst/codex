import { css, CSSResultGroup, LitElement } from 'lit/index.js'

export abstract class View extends LitElement {
  static styles: CSSResultGroup = css`
    a {
      color: inherit;
      text-decoration: inherit;
    }

    header {
      border-bottom: 1px solid black;
      text-align: center;
    }

    ul {
      list-style-type: none;
      margin-block-start: 0;
      margin-block-end: 0;
      padding-inline-start: 0;
    }
  `
}
