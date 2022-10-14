prefix : <#> .
prefix fpc: <https://fingerpaint.systems/core/> .
prefix html: <https://fingerpaint.systems/core/html/> .

{ [
  a :ListView ;
  :of +data ;
  html:root [ a html:UL ; html:children -list ]
] } when {
  [ a fpc:MappedList ;
    fpc:from +data ;
    fpc:via [
      a fpc:Query ;
      # MappedList expects +in and -out, with those names
      fpc:body { -out a :TodoView ; :of +in }
    ] ;
    fpc:to -list ]
} .

{ [ 
  a :TodoView ;
  :of +data ;
  html:root [
    a html:LI ;
    html:children (
      [ a html:Text ; html:value +data ]
    ) ]
] } .

[ a fpc:Rule ;
  fpc:head { [
    a fpc:MappedList ;
    fpc:from [ rdf:first +fFirst ; rdf:rest +fRest ] ;
    fpc:to [ rdf:first -tFirst ; rdf:rest -tRest ] ;
    fpc:via +query
  ] } ;
  fpc:body {
    [ a fpc:Call ;
      fpc:of +query ;
      fpc:with
        [ fpc:name 'in' ; fpc:value +fFirst ] ,
        [ fpc:name 'out' ; fpc:value -tFirst ] ] .
    [ a fpc:MappedList ;
      fpc:from +fRest ;
      fpc:to -tRest ;
      fpc:via +fn ] .
  }
]

{ [
  a fpc:MappedList ;
  # cons notation
  from ( +fFirst | +fRest ) ;
  to ( -tFirst | -tRest ) ;
  +via # single term is same as `via +via`
] } if {
  [ a fpc:Call ; of +via ;
    # not sure i like this? ?calleeVar = ?callerVar
    with { ?in = +fFirst . ?out = -tFirst } ] .
  [ a fpc:MappedList ; from +fRest ; to -tRest ; +via ] .
} .
