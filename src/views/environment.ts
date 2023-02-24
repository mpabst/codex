import { customElement, state } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { namedNode, Prefixers } from '../data-factory.js'
import { prefixify } from '../debug.js'
import { Environment } from '../environment.js'
import { BlankNode, Graph, Subject, Term } from '../term.js'
import './query.js'
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
      display: grid;
      grid-template-rows: 2rem auto;
      grid-template-areas:
        'list-header module-header subject-header'
        'module-list subject-list subject-data';
      gap: 1rem;
      padding: 1rem;
    }

    section.module-list > header {
      grid-area: list-header;
      display: flex;
      gap: 0.25rem;
    }

    section.module-list > ul {
      grid-area: module-list;
    }

    section.module > header {
      grid-area: module-header;
    }

    section.module > ul {
      grid-area: subject-list;
    }

    fp-subject {
      grid-area: subject-data;
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
    this.requestUpdate()
  }

  render() {
    return html`
      <main>
        ${this.renderModuleList()} ${this.module && this.renderModule()}
        ${this.subjectName &&
        html`<fp-subject
          graph="${this.moduleName}"
          subject="${this.subjectName}"
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
            <li @click=${() => (this.subjectName = k)}>${prefixify(k)}</li>
          `
        })}
      </ul>
    `
  }

  toggleAnon(ev: InputEvent) {}
}
