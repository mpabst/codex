import { customElement, property } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { Module } from '../module.js'
import { Subject } from '../term.js'
import { termConverter } from './helpers.js'
import './property-list.js'
import { View } from './view.js'

@customElement('fp-resource')
class ResourceView extends View {
  static styles = css`
    section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    header {
      border-bottom: 1px solid black;
    }
  `

  @property()
  module?: Module
  @property({ converter: termConverter })
  resource?: Subject

  render() {
    if (!this.module || !this.resource) return
    return html`
      <section>
        <header>${this.module.formatName(this.resource)}</header>
        <fp-property-list .module=${this.module} .resource=${this.resource} />
      </section>
    `
  }
}
