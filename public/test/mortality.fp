prefix : <#> .
prefix fpc: <https://fingerpaint.systems/core/> .

:socrates a :Man .

:mortality a fpc:Rule ;
  fpc:clause [
    fpc:head { ?who a :Mortal } ;
    fpc:body { ?who a :Man }
  ] .
