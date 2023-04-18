export const ESCAPER = '\\'

const QUOTES: { [k: string]: string } = {
  "'": "'",
  '"': '"',
  '<': '>',
}

export class NoMoreTokens {}

export class Lexer {
  token: string = ''

  #escape: boolean = false
  #quoting: string | null = null
  #pos: number = 0

  #line: number = 1
  #column: number = 0
  // if (this.column - token.length === 0), then
  // token's starting position is (lastLineLength - token.length) on the
  // previous line
  #lastLineLength: number = -1

  constructor(public source: string) {}

  advance(): void {
    this.token = ''
    for (; this.#pos < this.source.length; this.#pos++) {
      this.#column++
      const char = this.source[this.#pos]

      if (char === ESCAPER) {
        this.#escape = true
        continue
      }

      if (/\s/.test(char)) {
        if (char === '\n') {
          this.#line++
          this.#lastLineLength = this.#column
          this.#column = 0
        }
        if (this.token) return
        else continue
      }

      this.token += char

      if (this.#escape) this.#escape = false
      else if (this.#quoting) {
        if (char === QUOTES[this.#quoting]) this.#quoting = null
        // fixme: the next line is wrong, this.token is never '' by that
        // point
      } else if (char in QUOTES && !this.token) this.#quoting = char
    }
    throw new NoMoreTokens()
  }

  get tokenStart(): [number, number] {
    const startCol = this.#column - this.token.length
    if (startCol === 0)
      return [this.#line - 1, this.#lastLineLength - this.token.length]
    else return [this.#line, startCol]
  }
}
