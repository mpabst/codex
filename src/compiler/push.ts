// diff quads searching bodies
// - same instructions, pass body index to setIndex
// - what abt variable graph terms? how to restrict? the first thing
// to come to mind is to restrict it by what's already been bound
// - it's an in-var only, so it has to have had associated values. what if that
// set of values changes during push eval?
// how about
// - if bind to var graph, set aside. check other diff stmts first. if it's
// still unchecked afterwards, see if graph is in already fetched set. if yes,
// check, if not, discard

export function push() {}
