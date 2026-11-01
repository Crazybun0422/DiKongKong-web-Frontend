const fs=require('fs'),root='D:/Workspace/LowLatitudePlanet/app/src',pkg='/java/cn/llplanet/lowlatitudeplanet/rid/';
fs.writeFileSync(root+'/main'+pkg+'RidUsbSession.kt',`package cn.llplanet.lowlatitudeplanet.rid

/** A verified hello opens the session; every subsequent valid frame proves USB liveness. */
internal class RidUsbSession(startedAt:Long) {
    var ready=false; private set
    private var lastFrameAt=startedAt
    fun accept(frame:RidUsbFrame,now:Long):Boolean {
        if(frame.isHello)ready=true
        if(!ready || (frame.kind==0 && !frame.isHello))return false
        lastFrameAt=now
        return true
    }
    fun timedOut(now:Long)=now-lastFrameAt>6_000
}
`);
const file=root+'/main'+pkg+'RidUsbReceiver.kt';let code=fs.readFileSync(file,'utf8');
const edits=[
 ['var hello=false;var lastHello=SystemClock.elapsedRealtime();var rejected=0L','val session=RidUsbSession(SystemClock.elapsedRealtime());var rejected=0L'],
 ['if(frame.isHello){hello=true;lastHello=SystemClock.elapsedRealtime();state("connected")}\n                            if(hello)onFrame(frame)','if(session.accept(frame,SystemClock.elapsedRealtime())) {\n                                if(frame.isHello)state("connected")\n                                onFrame(frame)\n                            }'],
 ['if(SystemClock.elapsedRealtime()-lastHello>6000) {','if(session.timedOut(SystemClock.elapsedRealtime())) {'],
 ['state(if(hello)"stalled" else "firmware")','state(if(session.ready)"stalled" else "firmware")']
];code=code.replace(/\r\n/g,'\n');for(const [a,b]of edits){if(!code.includes(a))throw Error('Missing receiver block '+a);code=code.replace(a,b)}fs.writeFileSync(file,code);
fs.writeFileSync(root+'/test'+pkg+'RidUsbSessionTest.kt',`package cn.llplanet.lowlatitudeplanet.rid

import org.junit.Assert.*
import org.junit.Test

class RidUsbSessionTest {
    private fun frame(kind:Int=1)=RidUsbFrame(kind,0,0,1,0,-60,1,"01:02:03:04:05:06",
        if(kind==0)"LPD1".toByteArray()+ByteArray(12) else byteArrayOf(2,1,6))
    @Test fun oneHelloThenContinuousRidDoesNotReconnectAfterSixSeconds(){
        val session=RidUsbSession(0)
        assertTrue(session.accept(frame(0),0))
        // Same transmitter and sequence; live data must not be deduplicated away.
        for(now in 250L..180_000L step 250){
            assertTrue(session.accept(frame(),now))
            assertFalse(session.timedOut(now+249))
        }
        assertFalse(session.timedOut(186_000))
        assertTrue(session.timedOut(186_001))
    }
    @Test fun unverifiedTrafficCannotKeepHandshakeAlive(){
        val session=RidUsbSession(0)
        for(now in 0L..7_000L step 100)assertFalse(session.accept(frame(),now))
        assertFalse(session.ready);assertTrue(session.timedOut(7_000))
    }
    @Test fun corruptBytesNeverRefreshLivenessAndNextConnectionNeedsHello(){
        val session=RidUsbSession(0);session.accept(frame(0),0)
        val decoder=RidUsbProtocol()
        for(now in 1_000L..7_000L step 1_000){
            val frames=decoder.feed(byteArrayOf(1,2,3,0));assertTrue(frames.isEmpty())
            frames.forEach {session.accept(it,now)}
        }
        assertTrue(session.timedOut(7_000))
        val reconnect=RidUsbSession(8_000)
        assertFalse(reconnect.accept(frame(),8_001))
        assertTrue(reconnect.accept(frame(0),8_002))
        assertTrue(reconnect.accept(frame(),8_003))
    }
    @Test fun allVerifiedUsbTransportFramesKeepConnectionAlive(){
        val session=RidUsbSession(0);session.accept(frame(0),0)
        for(kind in 1..6){val now=kind*5_000L;assertTrue(session.accept(frame(kind),now));assertFalse(session.timedOut(now))}
    }
    @Test fun movingRidUpdatesPositionTelemetryAndPilotForEntireStream(){
        val session=RidUsbSession(0);session.accept(frame(0),0);val tracks=RidTracks()
        for(i in 1..720){
            val now=i*250L;assertTrue(session.accept(frame(),now))
            val latitude=31.0+i*0.00001;val pilot=31.1+i*0.00001
            tracks.accept("usb:one",RidObservation("serial",0,latitude,120.0,pilot,120.1,RidTelemetry(height=i.toDouble(),speed=i/10.0)),now)
            val result=tracks.snapshot(now);assertEquals(1,result.detected)
            assertEquals(latitude,result.points.single().latitude,0.0000001)
            assertEquals(pilot,result.points.single().pilotLatitude!!,0.0000001)
            assertEquals(i.toDouble(),result.contacts.single().telemetry!!.height!!,0.0)
            assertFalse(session.timedOut(now))
        }
    }
}
`);
console.log('Updated USB frame-based liveness and continuous-stream regression tests.');
