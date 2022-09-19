import <https://fingerpaint.systems/core/> .
import <https://fingerpaint.systems/html/> .
import <https://fingerpaint.systems/math/> .

:styles margin-top 4rem ; margin-left 4rem .

:Pendula a View ;
  head {
    [ a ol ; (
      [ a Pendulum ; index 0 ]
      [ a Pendulum ; index 1 ]
      [ a Pendulum ; index 2 ]
      [ a Pendulum ; index 3 ]
      [ a Pendulum ; index 4 ]
    ) ]
  } .

:Pendulum a View ;
  head {
    [ a div ;
      index ?i ;
      style [
        x ?x ; y ?y ;
        width 30px ; height 30px ;
        background-color red
      ]
    ] } ;
  body {
    :styles margin-top ?top ; margin-left ?left .
    [ a Product ; of ( ?top ?i ) ; is ?y ] .
    system tick ?t .
    [ a Sin ; of ?t ; is ?sin ] .
    [ a Sum ; of ( ?sin ?left ) ; is ?x ] .
  } .
