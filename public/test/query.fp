prefix : <#> .
prefix test: <http://127.0.0.1:8080/test/> .
prefix fpc: <https://fingerpaint.systems/core/> .

<> fpc:imports test:mortality.fp .

:whoIsMortal a fpc:Query ;
  fpc:body { ?who a test:mortality.fp#Mortal } .
