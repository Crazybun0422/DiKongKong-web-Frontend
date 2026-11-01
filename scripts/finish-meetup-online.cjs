const fs=require('fs');
const file=fs.readFileSync(__dirname+'/apply-meetup-online.cjs','utf8');
const start=file.indexOf("edit(index+'.wxml'");
const prefix=file.slice(0,file.indexOf("copy('FlightMeetupOnlineService"));
eval(prefix+"\nconst index=mini+'/packages/flight-meetups/index/index';\n"+file.slice(start));
