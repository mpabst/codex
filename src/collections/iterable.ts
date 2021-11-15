export function concat<T>(iter: Iterable<Iterable<T>>): T[] {
  const out = []
  for (const i of iter) for (const j of i) out.push(j)
  return out
}

export function filter<T>(iter: Iterable<T>, test: (t: T) => boolean): T[] {
  const out = []
  for (const i of iter) if (test(i)) out.push(i)
  return out
}

export function map<T, M>(iter: Iterable<T>, fn: (t: T) => M): M[] {
  const out = []
  for (const i of iter) out.push(fn(i))
  return out
}

export function permute<T>(choose: number, from: Iterable<T>): T[][] {
  if (choose === 1) return map(from, f => [f])
  return concat(
    map(from, f =>
      map(
        permute(
          choose - 1,
          filter(from, g => g !== f)
        ),
        p => concat([[f], p])
      )
    )
  )
}
