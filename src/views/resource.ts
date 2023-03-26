import { customElement, property } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { Module } from '../module.js'
import {
  BlankNode,
  Literal,
  Name,
  NamedNode,
  Object,
  Predicate,
  Subject,
  Term,
} from '../term.js'
import { termConverter } from './helpers.js'
import { View } from './view.js'

@customElement('fp-property')
export class PropertyView extends View {
  @property()
  module?: Module
  @property({ converter: termConverter })
  resource?: Subject
  @property({ converter: termConverter })
  property?: Predicate

  renderObject(p: Predicate, o: Object) {
    switch (o.constructor) {
      case Literal:
        return o.toString()
      case NamedNode:
        return o.toString()
      case BlankNode:
        return html`<fp-resource .module=${this.module} resource=${o.value} />`
      default:
        throw new Error(`unhandled term type: ${o.constructor.name}`)
    }
  }

  renderUnitaryProperty(p: Predicate, o: Object) {}
}

@customElement('fp-resource')
export class ResourceView extends View {
  static styles = css`
    section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    header {
      border-bottom: 1px solid black;
    }

    ul {
      list-style-type: none;
      margin-block-start: 0;
      margin-block-end: 0;
      padding-inline-start: 0;
    }
  `

  @property()
  module?: Module
  @property({ converter: termConverter })
  resource?: Subject

  render() {
    if (!this.module || !this.resource) return
    const props: Map<Term, Set<Term>> = this.module.subjects.get(this.resource)

    const items = []
    for (const p of (props ?? new Map()).keys())
      items.push(html`<li>
        <fp-property
          .module=${this.module}
          .resource=${this.resource}
          property=${p.value}
        />
      </li>`)

    const list =
      items.length > 0
        ? html`
            <ul>
              ${items}
            </ul>
          `
        : 'no data'

    return html`
      <section>
        <header>${this.module.formatName(this.resource)}</header>
        ${list}
      </section>
    `
  }
}
