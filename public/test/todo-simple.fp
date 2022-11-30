prefix : <#> .
prefix fpc: <https://fingerpaint.systems/core/> .
prefix html: <https://fingerpaint.systems/core/html/> .

:todos a rdf:List ;
  rdf:first [
    a :Todo ;
    rdfs:label "buy milk" ;
    :done false ;
    :createdAt "2022-09-01T00:00:00Z"
  ] ;
  rdf:rest [
    a rdf:List ;
    rdf:first [
      a :Todo ;
      rdfs:label "change oil" ;
      :done false ;
      :createdAt "2022-10-01T00:00:00Z"
    ] ;
    rdf:rest rdf:nil
  ] .

{ [
  a :FilteredList ;
  :in ( +inF | +inR ) ;
  :after +after ;
  :out ( -outF | -outR )
] } when {
  +inF :createdAt ?time .
  if { ?time > +after }
  then {
    -outF = +inF .
    [ a :FilteredList ;
      :in +inR ;
      :after +after ;
      :out -outR ] }
  else { [
    a :FilteredList ; 
    :in +inR ;
    :after +after ;
    :out ( -outF | -outR ) ] }
} .

{ [
  a :FilteredList ;
  :in rdf:nil ;
  :after ?_ ;
  :out rdf:nil
] } .

{ [
  a :ListView ;
  :of +data ;
  :after +after ;
  html:root [ a html:UL ; html:children -list ]
] } when {
  [ a :FilteredList ;
    :of +data ;
    :after +after ;
    rdf:first 
  ]


  +data
    rdf:first +one ;
    rdf:rest [ rdf:first +two ] .

  -list a rdf:List ;
    rdf:first [ a :TodoView ; :of +one ] ;
    rdf:rest [
      a rdf:List ;
      rdf:first [ a :TodoView ; :of +two ] ;
      rdf:rest rdf:nil
    ] .
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
