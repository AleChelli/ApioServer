//apio.js
/*
*	jshint strict: true
*	
*/
(function(){
"use strict";


/* Dependencies */
var com = require("serialport"); //Modulo comunicazione con la seriale
var MongoClient = require("mongodb").MongoClient;
var PrettyError = require('pretty-error');
var jade = require("jade");
var CronJob = require('cron').CronJob;
var time = require('time');
var fs = require("fs");


/**
	@module Apio
*/
var Apio = {};



/* Set to false to disable debugging messages */
Apio.DEBUG = true;

//TODO incapsulare l'oggetto Apio
Apio.getService = function(serviceName) {
	if ("undefined" == typeof Apio[serviceName])
		throw new Error("APIO::SDK::ERROR There is no sercvice named "+serviceName);
};

/*
*	Apio Util Service
*/
Apio.Util = {};

//TODO implementa servizio Apio.Logger
Apio.Util.debug = function(message) {
	if(Apio.DEBUG === true)
		console.log(message);
};
/*
*	Returns true if value is not null or undefined
*/
Apio.Util.isSet = function(value) {
	if (value !== null && "undefined" !== typeof value)
		return true;
	return false;
};
Apio.Util.printError = function(error) {
	var pe = new PrettyError();
	var renderedError = pe.render(error);
	console.log(renderedError);
}
/*
*	Convert a JSON object into a string written in the Codifica Apio and return it
*/
Apio.Util.JSONToApio = function(obj) {
	
	var string = "";
	string += obj.protocol+obj.objectId+":";
	//Se siamo in receiveSerialData, mi serve gestire il campo command
	if (obj.hasOwnProperty("command"))
		string += obj.command+":";
	//Aggiungo tutte le proprietà
	for (var key in obj.properties)
		string += key+":"+obj.properties[key]+"-";

	return string;
};
/*
*	Convert a string written in the Codifica Apio into a JSON object  and return it
*/
Apio.Util.ApioToJSON = function(str) {
	//var regex = /(.[a-z0-9])*\:([a-z0-9]*\:[a-z0-9]*\-).*/gi;
	var regex = /([lz])?(\w+)\:(send|update|register+)?\:?([\w+\:\w+\-]+)/;
	var match = regex.exec(str);
	var obj = {};
	if (Apio.Util.isSet(match[1]))
		obj.protocol = match[1];
	obj.objectId = match[2];
	if (Apio.Util.isSet(match[3]))
		obj.command = match[3];
	var mess = match[4];
		obj.properties = {};
	mess = mess.split("-");
	mess.pop();
	mess.forEach(function(e){
		console.log("Prima di splittare "+e);
		var t = e.split(":");
		console.log("Dopo aver splittato");
		console.log(t);
		obj.properties[t[0]] = t[1];
	});

	return obj;
};

Apio.Util.setCurrentHTTPRequest = function(req) {
	Apio.Util._httpRequest = req;
}
Apio.Util.getCurrentHTTPRequest = function() {
	return Apio.Util._httpRequest;
}

/**
*	Apio Logger Service
*	@class Logger
*/
Apio.Logger = {};

/*
*	@param logLevel
*	@param message
*/
Apio.Logger.log = function(tag,message) {
	var time = new Date();

	//Applica una logica che sceglie il meccanismo di logging
	//Probabilmente una query MongoDB
	//Per il momento è un mock
	console.log(time+" "+tag+" "+message);

			Apio.Database.db.collection("Logs").insert({
				"time" : time,
				"message" : message,
				"tag" : tag
			},function(err){
				if (err)
					throw new Error("Apio.Logger.log() encountered an error while trying to connect to the database");
			});

};

/**
*	Apio Socket
*	@class Socket
*
*/
Apio.Socket = {};
//FIXME Apio.io va incapsulato
Apio.Socket.init = function(httpInstance)
{
	if (!Apio.hasOwnProperty("io")) {
		Apio.io = require("socket.io")(httpInstance);
	}
};




/*
*	Apio Serial Service
*	@class Serial
*/
//FIXME wrappa completamente l"oogetto serialPort
Apio.Serial = {};

Apio.Serial.Error = function(message) {
	this.message = message;
	this.stack = (new Error()).stack;
};
/*
* Extend the Error Class
*/
Apio.Serial.Error.prototype = Object.create(Error.prototype);
Apio.Serial.Error.prototype.name = "Apio.Serial.Error";


Apio.Serial.Configuration = {
	port : "/dev/tty.usbmodem411",
	baudrate : 115200
}
/*
*	 Initializes the serial port service if it isn"t initialized
*/
Apio.Serial.init = function() {

	if (!Apio.Serial.hasOwnProperty("serialPort")){

		//FIXME sarebbe meglio incapsulare serialPort e nasconderla dall"esterno.

				Apio.Serial.serialPort = new com.SerialPort(Apio.Serial.Configuration.port, {
										    baudrate: Apio.Serial.Configuration.baudrate,
										    parser: com.parsers.readline("\r\n")
									});
				Apio.Serial.serialPort.on("open",function(){
						Apio.Util.debug("Apio.Serial.init() port is now open and listening on "+Apio.Serial.Configuration.port);
		                Apio.Serial.serialPort.on("data",function(serialString){
		                        Apio.Util.debug("Apio.Serial data received "+serialString);
		                        serialString = serialString.toString();
		                        //TODO add validation
		                        //TODO Cambierà in futuro perchè saranno supportati messaggi del
		                        
		                        var tokens = serialString.split(":");
		                        //Se la serialString è da meno di 4 token significa che non è wellformed (fatta bene)
		                        if (tokens.length >= 4) {
		                        	//Impacchetto la stringa ricevuta da seriale in un oggetto
			                       	var dataObject = Apio.Util.ApioToJSON(serialString);

			                        if(Apio.Util.isSet(dataObject.objectId) && Apio.Util.isSet(dataObject.command) )
			                        	Apio.Serial.read(dataObject);
			                        else{
			                        	//TODO ADD ACTUAL ERROR MANAGEMENT
			                        	Apio.Util.debug("APIO::SERIAL::DATA:IGNORED String is not well formed");
			                        }
		                        } else {
		                        	Apio.Util.debug("APIO::SERIAL::DATA:IGNORED String is too short ");
		                        }
		                        //Se arriva un evento da seriale non devo subito spararlo ai client, devo prima processarlo
		                        //Come in receiveSerialData.php
		                });
				});
				
				Apio.Serial.serialPort.on("close",function(){
					Apio.Util.debug("APIO::SERIAL::CLOSED");
				});
				return Apio.Serial.serialPort;
	}
};
/*
*	Take a JSON in input and split it into a regular Apio Codifica string 
*	adding the end transmission char -
*	and check the protocol type 
*/
Apio.Serial.send = 	function(data,callback) {
	//NOTA data dovrebbe mandare soltanto objID e le prop
		var message = "";
		for (var key in data.properties)
			message += key+":"+data.properties[key]+"-";

		//in teoria non serve utilizzarlo per come è attualmente (settembre) strutturato il sistema 
		//in quanto il protocollo è già incapsulato nell'oggetto JSON
		//la manteniamo in quanto non sappiamo come in futuro saranno implementate le gestioni dei 
		//protocolli w (wireless) e b (bluetooth)
		Apio.Database.getObjectById(data.objectId, function(obj){
			if(obj){
				data.address = obj.address;
				data.protocol = obj.protocol;
			}
			else{
				Apio.Database.db.collection("Objects").findOne({objectId : data.objectId}, function(error, result){
				if(result && error === null){
					data.address = result.address;
					data.protocol = result.protocol;
				}
				else{
					throw new Apio.Database.Error();
				}
			});

			}
			//if (data.protocol !== obj.protocol)
			//	throw new Error("Apio.Serial.Send() trying to communicate to object "+obj.objectId+" with the wrong protocol");
		switch(data.protocol) { //Devo usare data.protocol che è quella richiesta.
			case "z" :
				if (!Apio.Serial.hasOwnProperty("serialPort"))
					throw new Apio.Serial.Error("The Apio.Serial service has not been initialized. Please, call Apio.Serial.init() before using it.");
				Apio.Serial.serialPort.write(data.protocol+obj.address+":"+message,function(err,result){
								Apio.Util.debug("Apio.Serial.Send() wrote to serial the string:"+data.protocol+data.address+":"+message);
								if (Apio.Util.isSet(err))
									Apio.Util.debug("Apio.Serial.Send() ERROR: " + err);
								else
									Apio.Util.debug("Apio.Serial.Send() data wrote to serial and returned: " + result);
								if(callback){
									console.log("PARTE LA CALLBACK DELLA SERIAL");
									callback();
								}

				});
			break;
			case "l" :
				if (!Apio.Serial.hasOwnProperty("serialPort"))
					throw new Apio.Serial.Error("The Apio.Serial service has not been initialized. Please, call Apio.Serial.init() before using it.");
				Apio.Serial.serialPort.write(data.protocol+data.address+":"+message,function(err,result){
					Apio.Util.debug("Apio.Serial.Send() wrote to serial the string:"+data.protocol+data.address+":"+message);
					if (Apio.Util.isSet(err))
						Apio.Util.debug("Apio.Serial.Send() Error: " + err);
					Apio.Util.debug("Apio.Serial.Send() data wrote to serial and returned: " + result);
					if(callback){
						console.log("PARTE LA CALLBACK DELLA SERIAL");
						callback();
					}
			});
			break;
			case "w" :
				console.log("Apio.Serial.send() Sending "+message+" to HTTP object ")
				var req = http.request({
					host : '127.0.0.1',
					port : '8004',
					method : 'GET',
					path : '/'+message
				},function(response){
					response.on('data',function(data){
						console.log("Apio.Serial.send() http::response::data Data sent trough http to object")
					});
					response.on('end',function(){
						console.log("Apio.Serial.send() http::response::end Data sent trough http to object")
					})
					if(callback){
						console.log("PARTE LA CALLBACK DELLA SERIAL");
						callback();
					}
				});
				req.on('error',function(){
					console.log("Apio.Serial.send() http::request::error")
				});
				req.end();
			break;
			case "b" :
				//TODO
				if(callback){
					console.log("PARTE LA CALLBACK DELLA SERIAL");
					callback();
				}
			break;
			default :
				//Cerco nella cartella dell'oggetto, se ho una specifica per un protocollo proprietario, la uso
				//Ovvero faccio un require di un modulo che mi esporta un hash.
				//Questo hash non ha altro che delle stringhe di conversione
				if (fs.existsSync(__dirname+"/public/applications/"+obj.objectId+"/adapter.js")) {
				var adapter = require(__dirname+"/public/applications/"+obj.objectId+"/adapter.js");
				console.log("Sto per mandare all'adapter l'oggetto ");
				console.log(data);
				adapter.send(data);
				if(callback){
					console.log("PARTE LA CALLBACK DELLA SERIAL");
					callback();
				}
				} else {
					Apio.Util.debug("Apio.Serial.Send() Error: protocol "+obj.protocol+ "is not supported and no adapter was found.");
					// Do something
				}
			break;
		}
	});		
};

/*
*	used when the Server Apio has received some message on the serial from 
* 	an external Apio Object (mostly a Sensor/Button) which is trying to 
*	update some information on the database
*/
Apio.Serial.read = function(data) {
	
	//I sensori invieranno le seguenti informazioni
	//SensorID:command:Chiave:Valore
	//Quindi la funzione read, deve fare una query nel db per capire quale azione intraprendere
	//Per il momento invece, in fase di testing, i sensori inviano: TargetADDR:command:chiave:valore

	if (!Apio.Serial.hasOwnProperty("serialPort"))
			throw new Error("The Apio.Serial service has not been initialized. Please, call Apio.Serial.init() before using it.");

	switch(data.command) {
		case "send":
		
			//Prendo i dati ddell"oggetto in db, scrivo in seriale e updato il db.
			//In seriale verrà mandata una stringa del tipo
			//objId:command:chiavivalori

			//Invece di fare questa query, dovrò cercare gli eventi associati a quel sensore
			Apio.Database.getObjectById(data.objectId,function(object){
				//object contiene le informazioni aggiuntive dell'oggetto a cui inviare l'evento
				//tra cui l'address e il protocol
				data.objectId = object.objectId;
				data.protocol = object.protocol;

				Apio.Serial.send(data); //Mando data perchè ancora i sensori scrivono in seriale l'evento che vogliono scatenare
				//Poi invece manderò i dati recuperati dalla query getEventsByTrigger() o qualcosa del genere

				Apio.Database.updateProperty(data,function(){
					//Notificare i client connessi

					Apio.io.to("apio_client").emit("apio_server_update",data);
				});
			});
		break;
		case "update":
			console.log("%%%%%%%%%%%%Arrivato un update, mando la notifica");
			//Prima di tutto cerco la notifica nel db
			console.log(data);
			Apio.Database.db.collection('Objects').findOne({objectId : data.objectId},function(err,document){
				if (err) {
					console.log('Apio.Serial.read Error while looking for notifications');
				} else {
					if (document.hasOwnProperty('notifications')) {
						for (var prop in data.properties) //prop è il nome della proprietà di cui cerco notifiche
							if (document.notifications.hasOwnProperty(prop)) {
								//Ho trovato una notifica da lanciare
								if (document.notifications[prop].hasOwnProperty(data.properties[prop])){
									console.log("Ho trovato una notifica per la proprietà "+prop+" e per il valore corrispondente "+data.properties[prop])
									var notifica = {
										objectId : data.objectId,
										message : document.notifications[prop][data.properties[prop]]
									}
									console.log("Mando la notifica");
									Apio.System.notify(notifica);
								} //Se ha una notifica per il valore attuale
								else {
									console.log("Ho una notifica registarata per quella property ma non per quel valore")
								}

									
							} else{
								console.log("L'oggetto non ha una notifica registrata per la proprietà "+prop)
							}
					}
				}
			})
			//Apio.System.notify(data);
			Apio.Database.updateProperty(data,function(){
				Apio.io.emit('apio_server_update',data);
			});
		break;
		case "registration":
			//TODO
		break;
		default :
			//Il
		break;
	}

};



/*
*	Apio Database service
*/
Apio.Database = {};
//La connessione non viene Tenuta sempre aperta per questioni di stabilità.
//Questa scelta può essere rivista in caso di necessità di migliori performance
//TODO carica dati da un file di configurazione, insieme ai dati della seriale ecc..
Apio.Database.Configuration = {
	hostname : "127.0.0.1",
	database : "apio",
	port : "27017"
};
/*
* Take the configuration file of MongoDB and 
* return a string which can be used for the 
* connection to the DB
*/
Apio.Database.getConnectionString = function() {
	var c = Apio.Database.Configuration;
	return "mongodb://"+c.hostname+":"+c.port+"/"+c.database;
};
/*
	Returns the default database instance
*/
Apio.Database.getDatabaseInstance = function() {
	return Apio.Database.db;
}

Apio.Database.connect = function(callback) {
	MongoClient.connect( Apio.Database.getConnectionString(), function(error,db){
		if (error) {
			Apio.Util.debug("Apio.Database.connect() encountered an error while trying to connect to the database");
			return;
		}
		console.log("Apio.Database.connect() created a new connection to MongoDB");
		Apio.Database.db = db;
		if (callback)
			callback();
	})
};

Apio.Database.disconnect = function() {
	Apio.Database.db.close();
}

/**
*	Updates a property on the database
*
*	@param objectId
*	@param propertyName
*	@param propertyValue
*	@param callback
*
*/
Apio.Database.updateProperty = function(data,callback) {
		var objectId = data.objectId;
		var packagedUpdate = {};

		for (var key in data.properties)
			packagedUpdate["properties."+key] = data.properties[key];
		//db.collection("Objects").update({"objectId" : objectId},{ "$set" : packagedUpdate},function(error) {
			Apio.Database.db.collection("Objects").findAndModify({"objectId" : objectId},[["name",1]],{ "$set" : packagedUpdate},function(err,result){
			if(err) {
				Apio.Util.debug("Apio.Database.updateProperty() encountered an error while trying to update the property on the database: "+error);
				throw new Apio.Database.Error("Apio.Database.updateProperty() encountered an error while trying to update the property on the database");
			}
			else if (null === result) {
				throw new Apio.Database.Error("Apio.Database.updateProperty() the object with id "+objectId+"  does not exist.");
			} else {
				Apio.Util.debug("Apio.Database.updateProperty() Successfully updated the  object "+objectId);
				if (callback !== null)
					callback();
			}

		});
};

Apio.Database.getMaximumObjectId = function(callback){
	
	console.log('getMaximumObjectId');
	var error = null;
	var result = null;
	
	var options = { "sort": [['objectId','desc']] };
	Apio.Database.db.collection("Objects").findOne({}, options , function(err, doc) {
		if(err){
			error = 'Apio.Database.getMaximumObjectId() failed to fetch maximum objectId';
			console.log('Apio.Database.getMaximumObjectId() failed to fetch maximum objectId');
		}
		else{
	    	console.log('Recoverder as maximum id: ' + doc.objectId);
	    	result = doc.objectId;
		}
		callback(error,result);
	}); 

};

/* 
*	Exception object definition
*	This is very useful when doing error management, since it allows to understand which is the failure point
*	and handle the errror accordingly.
*
*	Ovvero, se dobbiamo implementare un sistema di transazioni atomiche, voglio sempre sapere a che punto
*	del processo si è verificato l'errore, in modo da applicare i giusti rollback
*/
Apio.Database.Error = function(message) {
	this.message = message;
	this.stack = (new Error()).stack;
};
Apio.Database.Error.prototype = Object.create(Error.prototype);
Apio.Database.Error.prototype.name = "Apio.Database.Error";


Apio.Database.registerObject = function(objectData,callback) {

			Apio.Database.db.collection("Objects").insert(objectData,function(error) {
				
				if(error) {
					throw new Apio.Database.Error("APIO::ERROR Apio.Database.registerObject() encountered an error while trying to update the property on the database"+error);
				}
				Apio.Util.debug("Apio.Database.registerObject() Object Successfully registered");
				callback(error);
				
			});
	

};



Apio.Database.deleteObject = function(id,callback) {

		Apio.Database.db.collection("Objects").remove({"objectId":id},function(error){
			if(error)
				throw new Apio.Database.Error("Apio.Database.deleteObject() encountered an error while trying to connect to the database");
			if(null !== callback)
			callback();
		});

};

Apio.Database.getObjects = function(callback) {
	

		Apio.Database.db.collection("Objects").find().toArray(function(error,result) {
			if(error) {
				throw new Apio.Database.Error("Apio.Database.getObjects() encountered an error while trying to update the property on the database"+error);
			}
			if(result === null) {
				//SE result è nullo, significa che nel db non è stato trovato alcun oggetto
				//Con l'id dato. Questo è un grave problema, indica che si sta richiedendo un oggetto non
				//Installato o non installato correttamente o che dei dati sono corrotti.

				//Ogni processo usato da app.js deve poter riconoscere il tipo di errore per gestirlo correttamente
				throw new Apio.Database.Error("Apio.Database.getObjects() Unable to fetch an object with id "+id);
			}
			Apio.Util.debug("Apio.Database.getObjectById() Objects Successfully fetched.");
			if (callback !== null)
				callback(result);
		});

};

Apio.Database.getObjectById = function(id,callback) {
	

		Apio.Database.db.collection("Objects").findOne({objectId : id},function(error,result) {
			if(error) {
				throw new Apio.Database.Error("Apio.Database.getObjectId() encountered an error while trying to update the property on the database"+error);
			}
			if(result === null) {
				//SE result è nullo, significa che nel db non è stato trovato alcun oggetto
				//Con l'id dato. Questo è un grave problema, indica che si sta richiedendo un oggetto non
				//Installato o non installato correttamente o che dei dati sono corrotti.

				//Ogni processo usato da app.js deve poter riconoscere il tipo di errore per gestirlo correttamente
				throw new Apio.Database.Error("Apio.Database.getObjectId() Unable to fetch an object with id "+id);
			}
			Apio.Util.debug("Apio.Database.getObjectById() Object Successfully fetched (id : "+id+")");
			if (callback !== null)
				callback(result);
			
		});

		

};

/*
* 	Apio Property Service
*	PHP functions
*/
Apio.Property = {};

Apio.Property.ApioSystemProperty = function(nomeStato,label, pushFlag) {
	//Di default pushFlag è true

	pushFlag = typeof pushFlag !== 'undefined' ? pushFlag : true;

	//Questa è la proprietà che contiene il body
	this._html = '';
	this.idInput = $nomestato+'input';
    this.id = this.idInput+'iPhone';
    this.nomestato = $nomestato;
    this.nometabella = this.getTableName();
    this.label = $label;
    this.box_proprieta = 'box_proprietaiPhone';
    this.testo_proprieta = 'testo_proprietaiPhone';
    this.content_pulsante = 'content_pulsanteiPhone';

    if(pushFlag){
            this._html += '<script type="text/javascript">proprieta_oggetto_attuale.push('+this.nomestato+');</script>';
        }
        
        this._html += '<script type="text/javascript">var model_'+this.nomestato+' = new Array();</script>';


}

Apio.Property.ApioSystemProperty.prototype.addClass = function($className, $file){
		$file = typeof $file !== 'undefined' ? $file : true;
        if($file != NULL){
            this._html +='<style>@import url('+$file+');</style>';
        }
        this._html += '<script type="text/javascript">document.getElementById('+this.nomestato+').className += '+$className+';</script>';
}

Apio.Property.ApioSystemProperty.prototype.dispositivo =  function() {
	    $ua = Apio.Util.getCurrentHTTPRequest().headers['user-agent'];

        if($ua.indexOf('iPhone')  !== -1){
            return 'iPhone';
        }
        if($ua.indexOf('iPad')  !== -1){
            return 'iPad';
        }
        else {
            return 'pc';
        }
}

Apio.Property.ApioSystemProperty.prototype.getBody = function(){
        return this.body;
    }

Apio.Property.ApioSystemProperty.prototype.getBoxProprieta = function(){
    return this.box_proprieta;
}

Apio.Property.ApioSystemProperty.prototype.getContentPulsante = function(){
    return this.content_pulsante;
}

Apio.Property.ApioSystemProperty.prototype.getId = function(){
    return this.id;
}

Apio.Property.ApioSystemProperty.prototype.getLabel = function(){
    return this.label;
}

Apio.Property.ApioSystemProperty.prototype.getNomestato = function(){
    return this.nomestato;
}

Apio.Property.ApioSystemProperty.prototype.getNometabella = function(){
    return this.nometabella;
}

Apio.Property.ApioSystemProperty.prototype.getRelativePath = function(){
	var id = Apio.Util.getCurrentHTTPRequest().query.zigbee;
	return 'apio_assets/oggetti/'+id+'/';
}

Apio.Property.ApioSystemProperty.prototype.getTableName = function() {
	return Apio.Util.getCurrentHTTPRequest().query.zigbee;
}

Apio.Property.ApioSystemProperty.prototype.getTestoProprieta = function(){
        return this.testo_proprieta;
}

function is_array(e) {
	if ('Object' == typeof e)
		return true;
	else
		return false;
}
Apio.Property.ApioSystemProperty.prototype.echo = function(t) {
	this._html += t;
}
Apio.Property.ApioSystemProperty.prototype.listener = function($e, $function){
        $events = $e.splice(" ");
        if($function === null){
            $func = 'updateProperty(\''+this.nomestato+'\', null, true)';
        }
        else if($function === true){
            $func = 'updateProperty(\''+this.nomestato+'\', null, true)';
        }
        else if($function === true){
            $func = 'updateProperty(\''+this.nomestato+'\', null, false)';
        }
        else{
            this._html+='<script type="text/javascript" src="'+this.getRelativePath()+'/listener/'+this.nomestato+'.js"></script>';
            if(!is_array($function)){
                $func = $function;
            }
        }
        
        $events.forEach(function($event,i,a){
        	if($event == 'hold' || $event == 'tap' || $event == 'doubletap'
            || $event == 'drag' || $event == 'dragstart' || $event == 'dragend'
            || $event == 'dragup' || $event == 'dragdown' || $event == 'dragleft'
            || $event == 'dragright' || $event == 'swipe' || $event == 'swipeup'
            || $event == 'swipedown' || $event == 'swipeleft' || $event == 'swiperight'
            || $event == 'transform' || $event == 'transformstart' || $event == 'transformend'
            || $event == 'rotate' || $event == 'pinch' || $event == 'pinchin'
            || $event == 'pinchout' || $event == 'touch' || $event == 'release'
            || $event == 'gesture'){
                if(is_array($function)){
                    for ($element in $function){
                    	var $func = $function[$element];
                        this.echo('<script type="text/javascript">var '+$element+'listener = Hammer(elemento'+$element+').on(\''+$event+'\', function(event){\n'+$func+';\n});</script>');
                    }
                }
                else{
                    this.echo('<script type="text/javascript">\nvar '+this.nomestato+'listener = Hammer(elemento'+this.nomestato+').on(\''+$event+'\', function(event){\n'+$func+';\n});\n</script>');
                }
            }
            else{
                if(is_array($function)){
                    for ($element in $function){
                    	var $func = $function[$element];
                        this.echo('<script type="text/javascript">\nvar elemento'+$element+' = document.getElementById(\''+$element+'\');elemento'+$element+'.addEventListener(\''+$event+'\', function(event){'+$func+';}, false);</script>');
                    }
                }
                else{
                    this.echo('<script type="text/javascript">\nvar elemento'+this.nomestato+' = document.getElementById(\''+this.nomestato+'\');\nelemento'+this.nomestato+'.addEventListener(\''+$event+'\', function(event){\n'+$func+';\n}, false);\n</script>');
                }
            }
        })
}

Apio.Property.ApioSystemProperty.prototype.UI = function() {

}

Apio.Property.ApioProperty = function() {

}
Apio.Property.ApioProperty.prototype.push = function(pushFunctionSignature) {
	//Aggiunge il push
	this._htmlPush = '<script type="text/javascript">//Push</script>';
	if ('undefined' == typeof pushFunctionSignature)
		this._htmlPush = '<script>'+pushFunctionSignature+'</script';
}
Apio.Property.ApioProperty.prototype.listener = function(pushFunctionSignature) {
	//Aggiunge il listener
	this._htmlListener = '<script type="text/javascript">//Listener</script>';
}
Apio.Property.ApioProperty.prototype.listenerCorrelation = function(pushFunctionSignature) {
	//Aggiunge la listener correlation
	this._htmlListenerCorrelation = '<script type="text/javascript">//ListenerCorrelation</script>';
}
Apio.Property.ApioProperty.prototype.viewCorrelation = function(pushFunctionSignature) {
	//Aggiunge la viewCorrelation
	this._htmlViewCorrelation = '<script type="text/javascript">//ViewCorrelation</script>';
}


Apio.Property.Trigger = function($nomestato, $offStatus, $onStatus, $pushFlag, $viewFile, $viewStatus) {

if ('undefined' == typeof $pushFlag)
	$pushFlag = true;
if ('undefined' == typeof $viewFile)
	$viewFile = null;
if ('undefined' == typeof $viewStatus)
	$viewStatus = null;

this.nomestato = $nomestato;
this.offStatus = $offStatus;
this.onStatus = $onStatus;
this.pushFlag = $pushFlag;
this.viewFile = $viewFile;
this.viewStatus = $viewStatus;
}
Apio.Property.prototype = new Apio.Property.ApioProperty();


Apio.Property.Trigger.prototype.render = function() {
	var html = jade.renderFile('views/properties/trigger.jade',this);
	console.log(html);
	return html;
}


Apio.Property.Slider = function() {}






Apio.System = {};
Apio.System.launchEvent = function(eventName,callback) {
	Apio.Database.db.collection('Events')
		.find({name : eventName})
		.toArray(
			function(error,data){

				if (error) {
					console.log("launchEvent() Error while fetching event data");
					callback(error);
				}
				if (data !== null) {

					if (data instanceof Array) {
						console.log("Data è un array di "+data.length+" elementi")
						data.forEach(function(e,i,v){
							console.log("Trovato un evento da lanciare")
							e.triggeredStates.forEach(function(_e,_i,_v){
								console.log("Trovato stato da triggerare: "+_e);
								console.log(_e)
								Apio.System.applyState(_e,function(err){
									//
								})
							})
						})
						if (callback)
							callback(null);
					} else {
						console.log("Data non è un array :/")
					}

				} else {
					console.log("nON c'è alcun evento chiamato dallo stato "+triggerState)
					callback("No events")
				}
			}
		);
}
Apio.System.applyState = function(stateName,callback) {
	Apio.Database.db.collection('States')
	.findOne({name : stateName},function(error,data){
		if (error) {
					console.log("applyState() Error while fetching event data");
					callback(error);
		}
		if (data == null) {
			console.log("applyState() the state "+stateName+" does not exist");
			callback({message : "applyState() the state "+stateName+" does not exist"})
		}
		else {
			//Ho trovato lo stato cercato
			Apio.Database.updateProperty(data,function(){
				console.log("Apio.System.applyState() state "+stateName+" successfully applied");

				Apio.Serial.send(data);

				callback(null);
			})
		}


	});
}

Apio.System.checkEvent = function(state) {
	//Se allo stato triggerato corrisponde un evento, lancia quell'evento
};

Apio.System.notify = function(notification,callback) {
	//Notifica a tutti gli utenti di un evento
	//Questo viene fatto inviando una notifica ai client attivi
	console.log("Ciao, sono Apio..System.notify e mi è arrivata questa notifica")
	notification.timestamp = (new Date()).getTime();
	console.log(notification);
	Apio.Database.db.collection('Users').update({},{$push : {"unread_notifications" : notification}},function(err,data){
		if (err)
			console.log("Apio.System.notify Error, unable to send the notification");
		else {
			console.log("Emitto la notifica");
			Apio.io.emit('apio_notification',notification);
			if (callback)
				callback();
		}
	})
	
}

Apio.System.jobs = {};

//Questa funzione deve essere chiamata alla creazione dell''evento se quell'evento è scheduled
Apio.System.registerCronEvent = function(event) {
	/*
		Seconds: 0-59
		Minutes: 0-59
		Hours: 0-23
		Day of Month: 1-31
		Months: 0-11
		Day of Week: 0-6

		* * * * * *
		00 10 16 20 * 
	*/
	console.log("Registro evento con timer ("+event.triggerTimer+")");
	Apio.System.jobs[event.name] = new CronJob(event.triggerTimer,
		function(){
			console.log("Apio.System Executing Scheduled Event '"+event.name+"'");
			Apio.System.launchEvent(event.name);//Lancio l'evento
		},
		function(){
			console.log("Event launched on time");
		},
		true,
		"Europe/Rome");
}
Apio.System.resumeCronEvents = function() { //FIX
	//Trova tutti gli eventi schedulati
	Apio.Database.db.collection('Events').find({triggerTimer : {$exists : true}}).toArray(function(err,docs){
		docs.forEach(function(event,i,a){
			Apio.System.registerCronEvent(event);
		})
	})
}
//FIXME SE riavvio il processo i cron task si perdono!
//Devo scriverli nel db e caricarli al bootstrap dell'applicazione
Apio.System.deleteCronEvent = function(eventName) {
	if (Apio.System.jobs.hasOwnProperty(eventName))
			delete Apio.System.jobs[eventName];
	else
		console.log("Apio.System.deleteCronEvent: unable to delete cron event "+eventName+" : the cron event does not exist;");
}

            


/*
*
-rwxrwxrwx 1 pi pi   372 set 17 15:49 ApioDynamicProperty.php
-rwxrwxrwx 1 pi pi 23681 set 17 15:49 ApioProperty.php
-rwxrwxrwx 1 pi pi 19116 set 17 15:49 ApioSystemProperty.php
-rwxrwxrwx 1 pi pi  2849 set 17 15:49 Button.php
-rwxrwxrwx 1 pi pi  1102 set 17 15:49 crontab1.php
-rwxrwxrwx 1 pi pi  2809 set 17 15:49 DynamicButton.php
-rwxrwxrwx 1 pi pi  3345 set 17 15:49 DynamicMultiple.php
-rwxrwxrwx 1 pi pi  2989 set 17 15:49 DynamicView.php
-rwxrwxrwx 1 pi pi  2983 set 17 15:49 Label.php
-rwxrwxrwx 1 pi pi  6475 set 17 15:49 MySQLTable.php
-rwxrwxrwx 1 pi pi  2385 set 17 15:49 Number.php
drwxrwxrwx 2 pi pi  4096 set 17 15:49 service
-rwxrwxrwx 1 pi pi  3727 set 17 15:49 Slider.php
drwxrwxrwx 2 pi pi  4096 set 17 15:49 system
-rwxrwxrwx 1 pi pi  2867 set 17 15:49 SystemButton.php
-rwxrwxrwx 1 pi pi  2815 set 17 15:49 SystemDynamicButton.php
-rwxrwxrwx 1 pi pi  3421 set 17 15:49 SystemDynamicMultiple.php
-rwxrwxrwx 1 pi pi  2995 set 17 15:49 SystemDynamicView.php
-rwxrwxrwx 1 pi pi  3001 set 17 15:49 SystemLabel.php
-rwxrwxrwx 1 pi pi  2403 set 17 15:49 SystemNumber.php
-rwxrwxrwx 1 pi pi  3745 set 17 15:49 SystemSlider.php
-rwxrwxrwx 1 pi pi  2383 set 17 15:49 SystemText.php
-rwxrwxrwx 1 pi pi  3124 set 17 15:49 SystemTrigger.php
-rwxrwxrwx 1 pi pi  2365 set 17 15:49 Text.php
-rwxrwxrwx 1 pi pi  3106 set 17 15:49 Trigger.php
*/




/** Module Pattern Implementation **/
module.exports = Apio;

Apio.Property.create = function(propertyName,def) {
	
}





})();

