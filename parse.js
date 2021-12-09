const N3 = require('n3')
const parser = new N3.Parser()

function parse(s) {
  parser.parse(s, (error, quad, prefixes) => {
    if (error)
      console.error(error)
    else if (quad)
      console.log(quad)
    else
      console.log("# That's all, folks!", prefixes)
  })
}
