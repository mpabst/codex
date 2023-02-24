import { customElement, state } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { Prefixers } from '../data-factory.js'
import { prefixify } from '../debug.js'
import { Environment } from '../environment.js'
import { BlankNode, Graph, Subject } from '../term.js'
import './subject.js'
import View from './view.js'

export const env = new Environment()

// showAnon toggle:
// <input
// name="show-anon"
// type="checkbox"
// @change=${(ev: InputEvent) => this.toggleAnon(ev)}
// value=${this.showAnon}
// />
// <label for="show-anon">show anon</label>

@customElement('fp-environment')
export class EnvironmentView extends View {
  static styles = css`
    main {
      display: flex;
      gap: 1rem;
      padding: 1rem;
    }

    section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    header {
      min-height: 2rem;
      display: flex;
      gap: 0.25rem;
    }

    ul {
      list-style-type: none;
      margin-block-start: 0;
      margin-block-end: 0;
      padding-inline-start: 0;
    }

    li {
      cursor: pointer;
    }
  `

  @state()
  showAnon = false
  @state()
  moduleName?: Graph
  @state()
  subjectName?: Subject

  protected toRefresh = ['fp-subject']

  get module() {
    return env.modules.get(this.moduleName!)
  }

  async loadModule(ev: MouseEvent) {
    const qname = (
      (ev.target as HTMLButtonElement).parentElement?.querySelector(
        '[name=module]',
      ) as HTMLInputElement
    ).value

    const [prefix, suffix] = qname.split(':')
    if (!(prefix in Prefixers)) throw new Error(`unknown prefix: ${prefix}:`)

    this.moduleName = Prefixers[prefix](suffix)
    await env.load(this.moduleName)
    this.refresh()
  }

  render() {
    return html`
      <main>
        ${this.renderModuleList()} ${this.module && this.renderModule()}
        ${this.subjectName &&
        html`<fp-subject
          graph="${this.moduleName!.value}"
          subject="${this.subjectName!.value}"
        />`}
      </main>
    `
  }

  renderModule() {
    return html`
      <section class="module">
        <header>${prefixify(this.moduleName!)}</header>
        ${this.renderSubjectList()}
      </section>
    `
  }

  renderModuleList() {
    return html`
      <section class="module-list">
        <header>
          <input name="module" type="text" placeholder="load module&hellip;" />
          <button @click=${(ev: MouseEvent) => this.loadModule(ev)}>
            load
          </button>
        </header>
        <ul>
          ${[...env.modules.keys()].map(k => {
            if (!this.showAnon && k instanceof BlankNode) return
            return html`<li @click=${() => (this.moduleName = k)}>
              ${prefixify(k)}
            </li>`
          })}
        </ul>
      </section>
    `
  }

  renderSubjectList() {
    if (!this.module) return
    return html`
      <ul>
        ${[...this.module.facts.getRoot('SPO').keys()].map(k => {
          if (!this.showAnon && k instanceof BlankNode) return
          return html`
            <li
              @click=${() => {
                this.subjectName = k
                this.refresh()
              }}
            >
              ${prefixify(k)}
            </li>
          `
        })}
      </ul>
    `
  }

  toggleAnon(ev: InputEvent) {}
}
