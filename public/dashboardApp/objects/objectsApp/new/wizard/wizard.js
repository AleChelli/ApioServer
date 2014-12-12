angular.module('ApioDashboardApplication')
.controller('WizardPanel', ['$scope','sweet','$http', function($scope,sweet,$http){

  $scope.tab = 1;
  $scope.hide = false;
  $scope.progressBarValue = 0;
  $scope.activeForm = 1;  

  this.saveFamily = function(family){
    $scope.newObject.microFamily=family.family;
    console.log('$scope.newObject.microFamily '+$scope.newObject.microFamily);
  };
  this.saveType = function(type){
    $scope.newObject.microType=type.type;
    console.log('$scope.newObject.microType '+$scope.newObject.microType);
  };
  $scope.selected = {};

  $scope.microData = [
      {
          "id" : "0",
          "family" : "Arduino",
          "types" : [
              { "type" : "Uno" },
              { "type" : "Mega" },
              { "type" : "Nano" }
          ]
      },{
          "id" : "1",
          "family" : "ST",
          "types" : [
              { "type" : "Uno" },
              { "type" : "Due" },
              { "type" : "Tre" }
          ]
      },{
          "id" : "2",
          "family" : "Apio",
          "types" : [
              { "type" : "Dongle" },
              { "type" : "General" }
          ]
      }
  ];


  this.doneForm = function(isValid){
    var self = this;
    sweet.show({
        title: "Apio Wizard completed.",
        text: "Your will not be able to change those information unless you use the Apio Editor them if you proceed!",
        type: "warning",
        showCancelButton: true,
        confirmButtonClass: "btn-warning",
        cancelButtonClass: "btn-info",
        confirmButtonText: "Proceed to Apio Editor",
        cancelButtonText: "Stay on the Wizard",
        closeOnConfirm: false,
        closeOnCancel: true 
      }, 
      function(isConfirm){   
         if (isConfirm) { 
          
          //sweet.show("Done!", "Your wizard procedure is done. Proceed to The Apio editor", "success");   
          sweet.show({
                      title: "Done!",
                      text: "Your wizard procedure is done. Proceed to The Apio editor",
                      type: "success",
                      showCancelButton: false,
                      confirmButtonClass: "btn-success",
                      confirmButtonText: "Ok",
                      closeOnConfirm: true
                    },
                    function(){
                        $scope.hideCreate=false;
                        $scope.hideCreateNew=true;
                        $scope.hideUpdate=true;
                        self.makeForm(isValid);
                    });

        }
       
      });
  }; 



  this.makeForm = function(isValid){
    console.log('makeForm');
    this.nextForm(isValid);
    console.log('Apio Summary Object successfully created');
    console.log($scope.newObject);
    this.parserIno($scope.newObject);
    this.parserHtml($scope.newObject);
    this.parserJs($scope.newObject);
    this.parserMongo($scope.newObject);
    this.parserMakefile($scope.newObject);
    $scope.ino = this.ino;
    $scope.html = this.html;
    $scope.js = this.js;
    $scope.mongo = this.mongo;
    $scope.makefile = this.makefile;
    console.log($scope.makefile);
    console.log('hide in makeForm before : ' + $scope.hide);
    $scope.hide = true;
    $scope.$apply();
    console.log('hide in makeForm after : ' + $scope.hide);
  }

  this.nextForm = function(isValid){
    if(isValid){
      console.log('nextForm')
      $scope.progressBarValue += 20;
      console.log('progressBarValue: '+ $scope.progressBarValue);
      console.log('previous activeForm : ' +$scope.activeForm);
      $scope.activeForm ++;
      console.log('actual activeForm : ' +$scope.activeForm);

      this.selectTab($scope.activeForm);
    };
  };
  
  this.previousForm = function(){
    $scope.progressBarValue -= 20;
    console.log('progressBarValue: '+ $scope.progressBarValue);
    $scope.activeForm --;
    this.selectTab($scope.activeForm);
  };

  this.isDisabled = function(checkTab){
    return checkTab !== $scope.activeForm;
  };

  this.selectTab = function(setTab){
    if(setTab===$scope.activeForm)
      $scope.tab = setTab;
  };

  this.isSelected = function(checkTab){
    return $scope.tab === checkTab;
  };

  this.parserTable = function(objectToParse){

  };

  this.parserMakefile = function(objectToParse){
    this.makefile = 'BOARD_TAG = ' + objectToParse.microType +'\n';
    this.makefile += 'ARDUINO_PORT = /dev/ttyACM0\n';
    this.makefile += 'ARDUINO_LIBS = \n';
    this.makefile += 'ARDUINO_DIR = /usr/share/arduino\n';
    this.makefile += 'include ../Arduino.mk';
  };

  this.parserMongo = function(objectToParse){
    this.mongo =  '{\n';
    this.mongo += '"name" : "'+objectToParse.objectName+'",\n';
    this.mongo += '"objectId" : "'+objectToParse.objectId+'",\n';
    this.mongo += '"protocol" : "'+objectToParse.protocol+'",\n';
    this.mongo += '"address" : "'+objectToParse.address+'",\n';
    this.mongo += '"properties": {\n';
    for(key in objectToParse.properties){
      if(objectToParse.properties[key].type.toLowerCase()==='list'){
        this.mongo += '\t\t"'+objectToParse.properties[key].name+'" : ';
        for(keykey in objectToParse.properties[key].items){
          this.mongo += '"'+keykey+'",\n';
          break
        };
      }else{
        this.mongo += '\t\t"'+objectToParse.properties[key].name+'" : "'+objectToParse.properties[key].defaultValue+'",\n';   
      }

    }
    if((Object.keys(objectToParse.properties)).length!==0)
      this.mongo = this.mongo.slice(0,this.mongo.length-2);
    this.mongo += '},\n';

    this.mongo += '"db" : {\n';
    for(key in objectToParse.properties){
      if(objectToParse.properties[key].type.toLowerCase()==='list'){
        this.mongo += '\t"' + objectToParse.properties[key].name + '" : {\n';
        for(keykey in objectToParse.properties[key].items){
          this.mongo += '\t\t"' + objectToParse.properties[key].items[keykey] + '" : "' + keykey  + '",\n';
        };
        this.mongo = this.mongo.slice(0,(this.mongo.length-2));
        this.mongo += '\n\t\t}\n';
      };
    };
    this.mongo += '\t}\n';
    this.mongo += '}';
  };

  /*
  the old parser used only for the DB part of the mongo.
  this.parserMongo = function(objectToParse){
    this.mongo = '"db" : {\n';
    for(key in objectToParse.properties){
      if(objectToParse.properties[key].type.toLowerCase()==='list'){
        this.mongo += '\t"' + objectToParse.properties[key].name + '" : {\n';
        for(keykey in objectToParse.properties[key].items){
          this.mongo += '\t\t"' + objectToParse.properties[key].items[keykey] + '" : "' + keykey  + '",\n';
        };
        this.mongo = this.mongo.slice(0,(this.mongo.length-2));
        this.mongo += '\n\t\t}\n';
      };
    };
    this.mongo += '\t}';
  };*/

  this.parserHtml = function(objectToParse){
     this.html='<div id="ApioApplication';
     this.html+=objectToParse.objectId +'" ng-app="ApioApplication' + objectToParse.objectId + '"  style="padding:10px;">\n';
     this.html+='\t<div ng-controller="defaultController">\n';
     this.html+='\t<topappapplication></topappapplication>\n';
     this.html+='\t\t<h2 style="text-align:center;">' + objectToParse.objectName + '</h2>\n';
     
     for(key in objectToParse.properties){
      
      this.html+='\t\t\t<' + objectToParse.properties[key].type.toLowerCase() +' propertyname="' + objectToParse.properties[key].name + '" ';
      
      if(objectToParse.properties[key].type.toLowerCase()==='trigger'){
        this.html+='labelon="'+ objectToParse.properties[key].onLabel +'" labeloff="'+ objectToParse.properties[key].offLabel +'">';
      }else if(objectToParse.properties[key].type.toLowerCase()==='slider'){
        this.html+='label="'+ objectToParse.properties[key].sliderLabel+'" min="' + objectToParse.properties[key].min + '" max="' + objectToParse.properties[key].max + '" step="' + objectToParse.properties[key].step + '">';
      }else if(objectToParse.properties[key].type.toLowerCase()==='list'){
        this.html+='label="'+ objectToParse.properties[key].listLabel+'" >';
      }else if(objectToParse.properties[key].type.toLowerCase()==='button'){
        this.html+='label="'+ objectToParse.properties[key].buttonLabel+'" innertext= " ">';
      }else if(objectToParse.properties[key].type.toLowerCase()==='number'){
        this.html+='label="'+ objectToParse.properties[key].numberLabel+'">';
      }else if(objectToParse.properties[key].type.toLowerCase()==='text'){
        this.html+='label="'+ objectToParse.properties[key].textBuilderLabel+'">';
      }

      this.html+='</' + objectToParse.properties[key].type.toLowerCase() + '>\n';

     };
     this.html+='\t</div>\n';
     this.html+='</div>\n';
     this.html+='<script src="applications/' + objectToParse.objectId + '/' + objectToParse.objectId + '.js"></script>';
  };

  this.parserJs = function(objectToParse){
    this.js = 'var app = angular.module(\'ApioApplication' + objectToParse.objectId + '\', [\'apioProperty\'])\n';
    this.js += 'app.controller(\'defaultController\',[\'$scope\', \'currentObject\', function($scope, currentObject){\n';
    this.js += '\tconsole.log("Sono il defaultController e l\'oggetto è")\n';
    this.js += '\tconsole.log(currentObject.get());\n';
    this.js += '\t$scope.object = currentObject.get();\n';
    this.js += '\t/**\n';
    this.js += '\t* [myCustomListener description]\n';
    this.js += '\t* @return {[type]} [description]\n';
    this.js += '\t*/\n';
    this.js += '\t$scope.myCustomListener = function() {';
    this.js += '\t\n';
    this.js += '\t}\n';
    this.js += '}]);\n\n';
    this.js += '\tsetTimeout(function(){\n';
    this.js += '\t\tangular.bootstrap(document.getElementById(\'ApioApplication' + objectToParse.objectId + '\'), [\'ApioApplication' + objectToParse.objectId + '\']);\n';
    this.js += '\t},10);\n';
  };

  this.parserIno = function(objectToParse){
    console.log('Parsing object ' + objectToParse + ' for .ino');
     this.ino='';
     if(objectToParse.protocol=='l'){
       //declare LWM libraries
       this.ino += '\n';
       this.ino += '#include "atmegarfr2.h"\n';
       this.ino += '#include "config.h"\n';
       this.ino += '#include "hal.h"\n';
       this.ino += '#include "halTimer.h"\n';
       this.ino += '#include "nwk.h"\n';
       this.ino += '#include "nwkCommand.h"\n';
       this.ino += '#include "nwkDataReq.h"\n';
       this.ino += '#include "nwkFrame.h"\n';
       this.ino += '#include "nwkGroup.h"\n';
       this.ino += '#include "nwkRoute.h"\n';
       this.ino += '#include "nwkRouteDiscovery.h"\n';
       this.ino += '#include "nwkRx.h"\n';
       this.ino += '#include "nwkSecurity.h"\n';
       this.ino += '#include "nwkTx.h"\n';
       this.ino += '#include "phy.h"\n';
       this.ino += '#include "sys.h"\n';
       this.ino += '#include "sysConfig.h"\n';
       this.ino += '#include "sysEncrypt.h"\n';
       this.ino += '#include "sysTimer.h"\n';
       this.ino += '#include "sysTypes.h"\n';
       this.ino += '\n';
       this.ino += '#include "ApioLwm.h"\n';

     } else if(objectToParse.protocol=='z'){
       //declare XBee libraries
       this.ino +="#include <XBee.h>\n#include <ApioXbee.h>\n";
     }

     for(key in objectToParse.pins){
       //declare Pins type name = value
       this.ino += "int "+objectToParse.pins[key].name+"="+objectToParse.pins[key].number+";\n";  
     }
     this.ino += "void setup() {\n";
     if(objectToParse.protocol=='l')
     {
       //initialize LWM
       this.ino += "apioSetup("+objectToParse.address+");\n";

     }else if(objectToParse.protocol=='z'){
       //initialize XBee
        this.ino +="\tSerial.begin(9600);\n";
     }

     for(key in objectToParse.pins){
       //pinMode(name, type);
       this.ino += "\tpinMode("+objectToParse.pins[key].name+","+objectToParse.pins[key].type+");\n"
     }

     this.ino += "}\n\n";
     this.ino += "void loop(){\n";
     if(objectToParse.protocol=='l'){
       this.ino+="\tapioLoop();\n";
     }
     if(objectToParse.protocol=='z'){
       this.ino+="\tapioLoop();\n";
     }
     for(key in objectToParse.properties)
     {
       this.ino += '\tif(property=="'+objectToParse.properties[key].name+'"){\n';
       if(objectToParse.properties[key].type=="Trigger")
       {
        console.log(objectToParse.properties[key]);
         this.ino +='\t\tif(value=="'+objectToParse.properties[key].on+'"){\n';
         this.ino += '\t\t\t//Do Something\n\t\t}\n';
         this.ino +='\t\tif(value=="'+objectToParse.properties[key].off+'"){\n';
         this.ino += '\t\t\t//Do Something\n\t\t}\n';
       }
       else if(objectToParse.properties[key].type=="List")
       {
         for(keykey in objectToParse.properties[key].items)
         {
           this.ino +='\t\tif(value=="'+objectToParse.properties[key].items[keykey]+'"){\n';
           this.ino +='\t\t\t//Do Something\n\t\t}\n';
         }
       }
       else
       {
         this.ino += '\t\t//Do Something\n\t';
       }
       this.ino += '}\n';       
     }
     this.ino +="}";
    };
}]);
