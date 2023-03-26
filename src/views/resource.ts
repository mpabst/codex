import { customElement, property } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { prefix } from '../debug.js'
import { Module } from '../module.js'
import {
  BlankNode,
  Literal,
  NamedNode,
  Object,
  Predicate,
  Subject,
  Term,
} from '../term.js'
import { termConverter } from './helpers.js'
import { View } from './view.js'

@customElement('fp-blank-node')
class BlankNodeView extends View {}

@customElement('fp-property')
export class PropertyView extends View {
  @property()
  module?: Module
  @property()
  resource?: Subject
  @property()
  property?: Predicate

  renderMultiple(objs: Object[]) {
    const items = []
    for (const o of objs) items.push(html`<li>${this.renderObject(o)}</li>`)
    return html`<div class="multiple">
      ${this.renderName()}
      <ul rel=${this.property!.value}>
        ${items}
      </ul>
    </div>`
  }

  renderName() {
    return html`<span class="property-name">
      ${this.module!.formatName(this.property!)}
    </span>`
  }

  renderNone() {
    return html`<div class="unitary">
      ${this.renderName()}
      <span class="none">(none)</span>
    </div>`
  }

  renderObject(o: Object) {
    switch (o.constructor) {
      case Literal:
        return o.value
      case NamedNode:
        return prefix(o)
      case BlankNode:
        return html`<fp-resource .module=${this.module} .resource=${o} />`
      default:
        throw new Error(`unhandled term type: ${o.constructor.name}`)
    }
  }

  renderUnitary(o: Object) {
    return html`<div class="unitary">
      ${this.renderName()}
      <span property=${this.property!.value}> ${this.renderObject(o)} </span>
    </div>`
  }

  render() {
    if (!this.module || !this.resource || !this.property) return
    const objs = [
      ...(this.module.subjects.get(this.resource)?.get(this.property) ??
        new Set()),
    ]
    if (!objs.length) return this.renderNone()
    else if (objs.length === 1 && !(objs[0] instanceof BlankNode))
      return this.renderUnitary(objs[0])
    else return this.renderMultiple(objs)
  }
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
          .property=${p}
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
