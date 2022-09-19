import fpc: <https://fingerpaint.systems/core/> .
import html: <https://fingerpaint.systems/html/> .

:socrates a :Man .

:mortality a fpc:Rule ;
  fpc:head { ?who a :Mortal } ;
  fpc:body { ?who a :Man } .

:MortalView a fpc:View ;
  fpc:head { [
    a html:h1 ; html:children (
      [ a html:TextNode ; html:value ?who ]
    ) ] } ;
  fpc:body { ?who a :Mortal } .
