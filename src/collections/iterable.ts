// TODO: Special case Array-specific operations to use their language defaults

// Unfortunately, generators and custom iterators appear to be 2-20x as slow as
// the language defaults, so it's not really worth it to make anything lazy
// unless we're working at a large scale. Maybe we could do a hybrid approach,
// which eagerly processes pages, which are lazily fetched/allocated?

// Or maybe better: a DSL for defining pipelines that, when run, invoke the
// language defaults

export function concat<T>(iter: Iterable<Iterable<T>>): T[] {
  const out = []
  for (const i of iter) for (const j of i) out.push(j)
  return out
}

export function every<T>(iter: Iterable<T>, test: (t: T) => boolean): boolean {
  return !some(iter, i => !test(i))
}

export function filter<T>(iter: Iterable<T>, test: (t: T) => boolean): T[] {
  const out = []
  for (const i of iter) if (test(i)) out.push(i)
  return out
}

export function first<T>(iter: Iterable<T>): T | undefined {
  for (const a of iter) return a
}

// Not totally sure this works
// export function flatMap<T, M>(
//   iter: Iterable<T | Iterable<T>>,
//   fn: (t: T) => M
// ): M[] {
//   let out: M[] = []
//   for (const i of iter) 
//     Symbol.iterator in i
//       ? (out = out.concat(flatMap(i as Iterable<T>, fn)))
//       : out.push(fn(i as T))
//   return out
// }

export function forEach<T>(iter: Iterable<T>, fn: (t: T) => void): void {
  for (const i of iter) fn(i)
}

export function intersect<T>(iters: Iterable<Iterable<T>>): T[] {
  const seen = sort(
    map(iters, i => new Set(i)),
    (a, b) => a.size - b.size
  )
  return filter(first(seen) || [], j => every(seen, s => s.has(j)))
}

export function map<T, M>(iter: Iterable<T>, fn: (t: T) => M): M[] {
  const out = []
  for (const i of iter) out.push(fn(i))
  return out
}

export function none<T>(iter: Iterable<T>, test: (t: T) => boolean): boolean {
  return !some(iter, test)
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

export function reduce<T, R>(
  iter: Iterable<T>,
  reducer: (r: R, t: T) => R,
  reduction: R
): R {
  for (const i of iter) reduction = reducer(reduction, i)
  return reduction
}

export function some<T>(iter: Iterable<T>, test: (t: T) => boolean): boolean {
  for (const i of iter) if (test(i)) return true
  return false
}

export function sort<T>(iter: Iterable<T>, comp: (a: T, b: T) => number): T[] {
  return Array.from(iter).sort(comp)
}

export function subtract<T>(
  minuend: Iterable<T>,
  subtrahend: Iterable<T>
): Iterable<T> {
  return filter(minuend, m => none(subtrahend, s => s === m))
}

export function union<T>(iters: Iterable<Iterable<T>>): T[] {
  return uniq(concat(iters))
}

export function uniq<T>(iter: Iterable<T>): T[] {
  const seen = new Set()
  return filter(iter, i => {
    if (seen.has(i)) return false
    seen.add(i)
    return true
  })
}
