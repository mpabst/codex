import { customElement, state } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { prefix, unprefix } from '../debug.js'
import { Environment } from '../environment.js'
import { BlankNode, Graph, Subject } from '../term.js'
import './resource.js'
import { View } from './view.js'

export const env = new Environment()

// showAnon toggle:
// <input
//   name="show-anon"
//   type="checkbox"
//   @change=${(ev: InputEvent) => this.toggleAnon(ev)}
//   value=${this.showAnon}
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

    form {
      min-height: 2rem;
      display: flex;
      gap: 0.25rem;
    }

    header {
      border-bottom: 1px solid black;
    }

    ul {
      list-style-type: none;
      margin-block-start: 0;
      margin-block-end: 0;
      padding-inline-start: 0;

      display: flex;
      flex-direction: column;
      gap: 0.5rem;
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
  resource?: Subject

  protected toRefresh = ['fp-resource']

  get module() {
    return env.modules.get(this.moduleName!)
  }

  async loadModule(ev: SubmitEvent) {
    ev.preventDefault()
    const qname = (ev.target as HTMLFormElement).module.value
    if (!qname) return
    this.moduleName = unprefix(qname)!
    await env.load(this.moduleName)
    this.refresh()
  }

  render() {
    // prettier-ignore
    return html`
      <main>
        ${this.renderModuleList()}
        ${this.renderModule()}
        ${this.resource &&
          html`<fp-resource .module=${this.module} resource=${this.resource.value} />`}
      </main>
    `
  }

  renderModule() {
    if (!this.moduleName) return
    return html`
      <section>
        <header>${prefix(this.moduleName!)}</header>
        ${this.renderSubjectList()}
      </section>
    `
  }

  renderModuleList() {
    const items = []
    for (const k of env.modules.keys())
      if (!this.showAnon && k instanceof BlankNode) return
      else
        items.push(html`<li @click=${() => (this.moduleName = k)}>
          ${prefix(k)}
        </li>`)

    return html`
      <section>
        <form @submit=${(ev: SubmitEvent) => this.loadModule(ev)}>
          <input name="module" type="text" placeholder="load module…" />
          <button>load</button>
        </form>
        <ul>
          ${items}
        </ul>
      </section>
    `
  }

  renderSubjectList() {
    if (!this.module) return
    const items = []
    for (const k of this.module.subjects.keys())
      if (!this.showAnon && k instanceof BlankNode) continue
      else {
        const click = () => {
          this.resource = k
          this.refresh()
        }
        items.push(html`<li @click=${click}>${this.module!.formatName(k)}</li>`)
      }

    return html`<ul>
      ${items}
    </ul>`
  }

  toggleAnon(ev: InputEvent) {}
}
