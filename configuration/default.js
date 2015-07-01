module.exports = {

	http : {
		port : 8083
	},

	serial : {
		enabled : true,
		port : '/dev/ttyACM0',
		baudrate : 115200
	},

	remote : {
		enabled : true,
		uri : 'http://comfortbox.cloudapp.net'
	},
	logging : {
		enabled:true,
		logfile : './logs/log.json'
	},

	database : {
		hostname: "127.0.0.1",
        database: "apio",
        port: "27017"
	}



}
