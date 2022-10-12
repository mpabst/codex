export class ParseError extends Error {}

export function isLiteral(token: string): boolean {
  return /^[+-\d'"]/.test(token) || ['true', 'false'].includes(token)
}

export function unwrap(s: string): string {
  return s.slice(1, -1)
}
