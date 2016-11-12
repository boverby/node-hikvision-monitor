#!/usr/bin/nodejs


// node-hikvision-monitor -
// based on external config file, listen to several cameras and sent events to mqttBroker

// application of https://github.com/nayrnet/node-hikvision-api for additional cameras

// can observe activity with "mosquitto_sub -h [mqttBroker] -v -t cameras/#"

var fs          = require('fs'),
    cfgFile     = '/etc/node-hikvision.conf',
    cfg         = JSON.parse( fs.readFileSync(configurationFile)),
    Promise     = require("bluebird"),
    ipcamera    = Promise.promisifyAll (require('node-hikvision-api') ),
    log4js      = require('log4js'),
    dateFormat  = require('dateformat'),
    mqtt        = require('mqtt')  ,
    mq_client   = mqtt.connect('mqtt://'+cfg.mqttBroker)  ,
    cameras     = cfg.cameras;


log4js.clearAppenders() ;  // removes default console output
log4js.loadAppender('file');
log4js.addAppender(log4js.appenders.file(cfg.logFile), 'n-h-m')
var logger = log4js.getLogger('n-h-m');
    logger.setLevel(cfg.logLevel) ;
    logger.info('starting');

var cameraList = Object.keys(cameras);
    logger.debug( 'cameras '+ JSON.stringify(cameraList, null, 4) );
 
var startTimes={};

for (var cam in cameraList) {
    var thisCam = cameraList[cam];
    logger.debug(" camera "+JSON.stringify(cameras[thisCam]) );
    trackCamera(thisCam);
}

function trackCamera( cam ){
     return new Promise( function (resolve,reject){
        logger.debug('note: starting '+cam );
        var connection = new ipcamera.hikvision( cameras[cam]);
        connection.on('connect', function(){
                 mq_client.publish('cameras/'+cameras[cam].host+'/state', 'connected');
        })

        connection.on( 'alarm', function(code,action,index) {
             if (code === 'VideoMotion' ){
               if ( action === 'Start') {
                             logger.debug('Channel ' + index + ': '+
                                         cameras[cam].host+' Video Motion Detected' );
                             mq_client.publish('cameras/'+cameras[cam].host+'/state', 'recording');
                             startTimes[cam]= new Date();
                                         };
               if ( action === 'Stop') {
                             var endTime = new Date();
                             var elapsedTime = Math.floor( (endTime.getTime() - startTimes[cam].getTime()) /1000 );
                             logger.info(
                                         cameras[cam].host+'|'+
                                         dateFormat(startTimes[cam], "yyyy-mm-dd h:MM:ss") +'|'+
                                         dateFormat(endTime, "yyyy-mm-dd h:MM:ss") +'|'+
                                         Math.floor(startTimes[cam].getTime()/1000)+'|'+
                                         Math.floor(endTime.getTime()/1000)+'|'+
                                         elapsedTime );
                             //dateFormat(result.request_date, "yyyy-mm-dd h:MM:ss");
                             mq_client.publish('cameras/'+cameras[cam].host+'/state', 'stopped');
                             mq_client.publish('cameras/'+cameras[cam].host+'/event', 'et:'+elapsedTime);

                                         };
             }
           })


     });
};


function getDateTime() {
    var date = new Date();
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;
    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;
    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;
    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;
    return year + "-" + month + "-" + day + " " + hour + ":" + min + ":" + sec;
}
