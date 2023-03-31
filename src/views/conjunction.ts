import { consume } from '@lit-labs/context'
import { html, PropertyValues } from 'lit'
import { customElement, property, state } from 'lit/decorators'
import { Branch, QuadSet } from '../collections/data-set.js'
import { Prefixers } from '../data-factory.js'
import { getProps, getReifiedQuad } from '../helpers.js'
import { Graph, Subject } from '../term.js'
import { envContext, EnvironmentView, spoContext } from './environment'
import { termConverter } from './helpers.js'
import { View } from './view.js'

const { fpc } = Prefixers

@customElement('fp-conjunction')
class ConjunctionView extends View {
  @property({ converter: termConverter })
  declare resource?: Subject

  @consume({ context: envContext() })
  @state()
  declare env: EnvironmentView

  @consume({ context: spoContext() })
  @state()
  declare spo: Branch

  declare patterns: QuadSet

  constructor() {
    super()
    this.initPatterns()
  }

  initPatterns() {
    this.patterns = new QuadSet('GSPO')
  }

  loadPatterns() {
    if (this.patterns.size) this.initPatterns()
    for (const pat of getProps(this.spo, this.resource!).get(fpc('conjunct')))
      this.patterns.add(getReifiedQuad(this.spo, pat))
  }

  render() {
    return [...this.patterns.root].map(pair => this.renderGraph(...pair))
  }

  renderGraph(g: Graph, ss: Branch) {
    const subs = []
    for (const s of ss)
      subs.push(html`<fp-resource .resource=${s}></fp-resource>`)
    return html`<h6>${this.env.formatName(g)}</h6>
      <fp-triple-context .spo=${ss}><div>${subs}</div></fp-triple-context>`
  }

  willUpdate(changed: PropertyValues<this>) {
    if (changed.has('resource')) this.loadPatterns()
  }
}
