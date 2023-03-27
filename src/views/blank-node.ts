import { consume } from '@lit-labs/context'
import { customElement, property, state } from 'lit/decorators.js'
import { html } from 'lit/index.js'
import { Prefixers } from '../data-factory.js'
import { getProps, mapList } from '../helpers.js'
import { A, BlankNode, Term } from '../term.js'
import { envContext, EnvironmentView } from './environment.js'
import './property-list.js'
import './term.js'
import { View } from './view.js'

const { fpc, rdf } = Prefixers

@customElement('fp-blank-node')
class BlankNodeView extends View {
  @property()
  declare resource: BlankNode

  @consume({ context: envContext() })
  @state()
  declare env: EnvironmentView

  render() {
    const types = getProps(this.env.module!, this.resource).get(A)

    if (types.has(rdf('List'))) return this.renderList()

    if ([rdf('Statement'), fpc('Pattern')].some(t => types.has(t)))
      return this.renderStatement()

    return html`<fp-property-list .resource=${this.resource} />`
  }

  renderList() {
    return html`
      <ol>
        ${mapList(
          this.env.module!,
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
