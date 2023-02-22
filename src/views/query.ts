import { customElement, property } from 'lit/decorators.js'
import { css, html, nothing } from 'lit/index.js'
import { Clause } from '../clause.js'
import { CurlyDataSet } from '../collections/data-set.js'
import { prefixify } from '../debug.js'
import { Argument, Instruction, Operation } from '../processor.js'
import { Query } from '../query.js'
import { Term, Variable } from '../term.js'
import View from './view.js'

// These could be summarized by /Var/.test(op.name) ? pos === 1 ? ...
// but they're already written so I'll keep them. Why is this pattern
// here? I don't remember deciding to make the second arg always callee
// relative
const scopeRelative: { [k: string]: (1 | 2)[] } = {
  memoizeVar: [1],
  eMedialNewVar: [1],
  eMedialOldVar: [1],
  eFinalNewVar: [1],
  eFinalOldVar: [1],
  iNewVarConst: [1],
  iNewVarVar: [1],
  iOldVarConst: [1],
  iOldVarVar: [1],
}
const calleeRelative: { [k: string]: (1 | 2)[] } = {
  iConstVar: [2],
  iNewVarVar: [2],
  iOldVarVar: [2],
}

@customElement('fp-query')
export default class QueryView extends View {
  static styles = css`
    .program td {
      white-space: nowrap;
    }

    .current {
      background-color: dodgerblue;
      color: white;
    }
  `

  @property()
  programP: number = -1
  @property({ attribute: false })
  query?: Query

  render() {
    if (!this.query) return
    return html`
      <table class="program">
        <tbody>
          ${this.query.program.map((instr, i) =>
            this.renderInstruction(instr, i),
          )}
        </tbody>
      </table>
    `
  }

  renderArgument(op: Operation, arg: Argument, pos: 1 | 2) {
    let out = arg

    const calleeVar = (): Variable => {
      const callees = this.query!.callees
      let i = callees.length - 1
      while (callees[i].offset > (arg as number)) i--
      return callees[i].target.vars[arg as number - callees[i].offset]
    }

    if (arg === null) out = ''
    if (typeof arg === 'number') {
      if (scopeRelative[op.name]?.includes(pos)) out = this.query!.scope[arg]
      if (calleeRelative[op.name]?.includes(pos)) out = calleeVar()
    }
    if (arg instanceof CurlyDataSet) out = arg.parent!.name
    if (arg instanceof Term) out = arg

    return prefixify(out)
  }

  renderInstruction([op, left, right]: Instruction, i: number) {
    return html`<tr class=${i === this.programP ? 'current' : nothing}>
      <td>${i}</td>
      <td>${op.name}</td>
      <td>${this.renderArgument(op, left, 1)}</td>
      <td>${this.renderArgument(op, right, 2)}</td>
    </tr>`
  }
}