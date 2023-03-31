import { customElement, property, query } from 'lit/decorators.js'
import { css, html, PropertyValues } from 'lit/index.js'
import { Prefixers } from '../data-factory.js'
import { unprefix } from '../debug.js'
import { Environment } from '../environment.js'
import { getProps } from '../helpers.js'
import { TopLevel } from '../query.js'
import { termConverter } from './helpers.js'
import './processor.js'
import ProcessorView from './processor.js'
import './triple-table.js'
import { View } from './view.js'

const { fpc, test } = Prefixers

@customElement('fp-debugger')
export class Debugger extends View {
  static styles = css`
    .container {
      display: flex;
    }
  `

  @property({ converter: termConverter })
  declare module: string

  declare env: Environment

  @query('fp-processor')
  declare proc: ProcessorView

  constructor() {
    super()
    this.env = new Environment()
  }

  async loadModule() {
    if (!this.module) return

    const node = unprefix(this.module)
    const mod = await this.env.load(node)

    // FIXME: just hardcode which query for now
    const body = getProps(mod, test('append#query')).getUValue(fpc('body'))

    this.env.proc.query = new TopLevel(mod, body)
    this.env.proc.initArgs(new Map())

    this.proc.requestUpdate()
  }

  render() {
    return html`<fp-processor .proc=${this.env.proc} />`
  }

  willUpdate(changed: PropertyValues<this>) {
    if (changed.has('module')) this.loadModule()
  }
}
