import { consume } from '@lit-labs/context'
import { customElement, property, state } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { Branch } from '../collections/data-set.js'
import { Prefixers } from '../data-factory.js'
import { getProps, mapList } from '../helpers.js'
import { A, BlankNode, Term } from '../term.js'
import { spoContext } from './environment.js'
import './conjunction.js'
import './property-list.js'
import './term.js'
import { View } from './view.js'

const { fpc, rdf } = Prefixers

@customElement('fp-blank-node')
class BlankNodeView extends View {
  @property()
  declare resource: BlankNode

  @consume({ context: spoContext() })
  @state()
  declare spo: Branch

  render() {
    const types = getProps(this.spo, this.resource).get(A)
    const perType = []

    if (types.has(fpc('Conjunction')))
      perType.push(
        html`<fp-conjunction .resource=${this.resource}></fp-conjunction>`,
      )
    if (types.has(rdf('List'))) perType.push(this.renderList())

    // if ([rdf('Statement'), fpc('Pattern')].some(t => types.has(t)))
    //   return this.renderStatement()

    return perType.length
      ? perType
      : html`<fp-property-list .resource=${this.resource} />`
  }

  renderList() {
    return html`
      <ol>
        ${mapList(
          this.spo,
          this.resource,
          (t: Term) => html`<fp-term .term=${t} />`,
        )}
      </ol>
    `
  }

  renderStatement() {
    return 'renderStatement()'
  }
}
