export const ESCAPER = '\\'

const QUOTES: { [k: string]: string } = {
  "'": "'",
  '"': '"',
  '<': '>',
}

export class NoMoreTokens {}

export class Lexer {
  token: string = ''
  escape: boolean = false
  quoting: string | null = null
  pos: number = 0

  constructor(public source: string) {}

  advance(): void {
    this.token = ''
    for (; this.pos < this.source.length; this.pos++) {
      const char = this.source[this.pos]

      if (char === ESCAPER) {
        this.escape = true
        continue
      }

      if (/\s/.test(char)) {
        if (this.token !== '') return
        else continue
      }

      this.token += char

      if (this.escape) this.escape = false
      else if (this.quoting) {
        if (char === QUOTES[this.quoting]) this.quoting = null
      // fixme: the next line is wrong, this.token is never '' by that
      // point
      } else if (char in QUOTES && this.token === '') this.quoting = char
    }
    throw new NoMoreTokens()
  }
}
