export class ParseError extends Error {}

export function unwrap(s: string): string {
  return s.slice(1, -1)
}
