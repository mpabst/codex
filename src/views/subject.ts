import { customElement, property } from 'lit/decorators.js'
import { css, html } from 'lit/index.js'
import { namedNode } from '../data-factory.js'
import { prefixify } from '../debug.js'
import { Graph, Subject, Term } from '../term.js'
import { env } from './environment.js'
import { View } from './view.js'

const converter = {
  fromAttribute: (value: string) => namedNode(value),
  toAttribute: ({ value }: Term) => value,
}

@customElement('fp-subject')
export class SubjectView extends View {
  static styles = css`
    section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    ul {
      list-style-type: none;
      margin-block-start: 0;
      margin-block-end: 0;
      padding-inline-start: 0;
    }
  `

  @property({ converter })
  graph?: Graph
  @property({ converter })
  subject?: Subject

  render() {
    if (!this.graph || !this.subject) return
    const props = env.modules
      .get(this.graph!)
      ?.facts.getRoot('SPO')
      .get(this.subject!) as Map<Term, Set<Term>>
    if (!props) return html`not found`

    return html`
      <section>
        <header>${prefixify(this.subject)}</header>
        <table>
          ${[...props.entries()].flatMap(([p, oo]) =>
            [...oo].map(
              o => html`
                <tr>
                  <td>${prefixify(p)}</td>
                  <td>${prefixify(o)}</td>
                </tr>
              `,
            ),
          )}
        </table>
      </section>
    `
  }
}
