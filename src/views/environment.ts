import { createContext, provide } from '@lit-labs/context'
import { customElement, state } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { prefix, unprefix } from '../debug.js'
import { Environment } from '../environment.js'
import { Module } from '../module.js'
import { A, BlankNode, Name, Subject } from '../term.js'
import './resource.js'
import './term.js'
import { View } from './view.js'

export const env = new Environment()

export function envContext() {
  return createContext<EnvironmentView>('env')
}

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
  static styles = [
    View.styles,
    css`
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

      ul {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      li {
        cursor: pointer;
      }
    `,
  ]

  @state()
  declare module: Module | null

  @state()
  declare moduleName?: Name

  @state()
  declare resource?: Subject

  @state()
  declare showAnon: boolean

  @provide({ context: envContext() })
  declare _this: typeof this

  constructor() {
    super()
    this.module = null
    this.showAnon = false
    this._this = this
  }

  loadModule = async (ev: SubmitEvent) => {
    ev.preventDefault()
    const qname = (ev.target as HTMLFormElement).module.value
    if (!qname) return
    this.moduleName = unprefix(qname)
    this.module = await env.load(this.moduleName)
  }

  setModuleName = (s: Subject) => (ev: MouseEvent) => {
    ev.preventDefault()
    this.moduleName = s
  }

  setResource = (s: Subject) => (ev: MouseEvent) => {
    ev.preventDefault()
    this.resource = s
  }

  formatName(name: Name): string {
    if (name === A) return 'a'
    const prefixed = prefix(name)
    const replaced = prefixed.replace(this.module?.prefix ?? '', '')
    return replaced.length ? replaced : prefixed
  }

  render() {
    // prettier-ignore
    return html`
      <main>
        ${this.renderModuleList()}
        ${this.renderModule()}
        ${this.resource &&
          html`<fp-resource resource=${this.resource.value}></fp-resource>`}
      </main>
    `
  }

  renderModule() {
    if (!this.moduleName) return
    return html`
      <section>
        <header>${prefix(this.moduleName)}</header>
        ${this.renderSubjectList()}
      </section>
    `
  }

  renderModuleList() {
    const items = []
    for (const k of env.modules.keys())
      if (!this.showAnon && k instanceof BlankNode) return
      else
        items.push(html`<li>
          <fp-term .term=${k} .linkHandler=${this.setModuleName}></fp-term>
        </li>`)

    return html`
      <section>
        <form @submit=${this.loadModule}>
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
      if (this.showAnon || !(k instanceof BlankNode))
        items.push(html`<li><fp-term .term=${k}></fp-term></li>`)
    return html`<ul>
      ${items}
    </ul>`
  }

  toggleAnon(ev: InputEvent) {}
}
