export function get<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  let found = map.get(key)
  if (!found) {
    found = factory()
    map.set(key, found)
  }
  return found
}
