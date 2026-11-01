const fs=require('fs'),path=require('path');
const root='D:/Workspace/LowLatitudePlanet/app/src';
const main=path.join(root,'main/java/cn/llplanet/lowlatitudeplanet');
function edit(file,fn){const s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');fs.writeFileSync(file,fn(s));}
function rep(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b);}
fs.writeFileSync(path.join(main,'data/ReadRequestSignal.kt'),`package cn.llplanet.lowlatitudeplanet.data

import java.net.HttpURLConnection
import java.util.concurrent.ForkJoinPool
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.CancellationException

/** Only used by cancellable map GETs. Deliberate cancellation is not a network failure. */
class ReadRequestSignal {
    private val cancelled=AtomicBoolean(false)
    private val connection=AtomicReference<HttpURLConnection?>(null)
    fun check() { if(cancelled.get()) throw CancellationException("Map viewport replaced") }
    fun attach(value:HttpURLConnection) {
        connection.set(value)
        if(cancelled.get()) { connection.getAndSet(null)?.disconnect(); check() }
    }
    fun detach(value:HttpURLConnection) { connection.compareAndSet(value,null) }
    fun cancel() {
        cancelled.set(true)
        connection.getAndSet(null)?.let { value ->
            // HttpURLConnection.disconnect can wait for its reader; never block the UI thread.
            ForkJoinPool.commonPool().execute { runCatching {value.disconnect()} }
        }
    }
}
`);
edit(path.join(main,'data/PlanetApi.kt'),s=>{
  s=rep(s,'method:String="GET"):ByteArray {','method:String="GET",requestSignal:ReadRequestSignal?=null):ByteArray {\n        requestSignal?.check()');
  s=rep(s,'        val url=URL(if(path.startsWith("https://")) path else "$base$path")','        requestSignal?.check()\n        val url=URL(if(path.startsWith("https://")) path else "$base$path")');
  s=rep(s,'        try {\n            if(body!=null)', '        try {\n            requestSignal?.attach(conn)\n            requestSignal?.check()\n            if(body!=null)');
  s=rep(s,'            val bytes=conn.inputStream.use { it.readBytes() }','            val bytes=conn.inputStream.use { it.readBytes() }\n            requestSignal?.check()');
  s=rep(s,'        } catch(error:Exception) {\n            offlineNetwork.result','        } catch(error:Exception) {\n            requestSignal?.check()\n            offlineNetwork.result');
  s=rep(s,'        } finally { conn.disconnect() }\n    }\n    fun json','        } finally { requestSignal?.detach(conn); conn.disconnect() }\n    }\n    fun json');
  return rep(s,'    fun data(path:String,auth:Boolean=false)=json(path,auth).opt("data")',`    fun data(path:String,auth:Boolean=false)=json(path,auth).opt("data")
    /** Nearby map reads stop their socket when the owning viewport coroutine is cancelled. */
    suspend fun nearbyMapData(path:String):Any? {
        require(path.startsWith("/api/no-fly-zones/nearby?"))
        return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            kotlinx.coroutines.suspendCancellableCoroutine { continuation ->
                val signal=ReadRequestSignal()
                continuation.invokeOnCancellation { signal.cancel() }
                try {
                    val body=JSONObject(bytes(path,requestSignal=signal).toString(Charsets.UTF_8))
                    if(body.has("success")&&!body.optBoolean("success"))throw ApiFailure(200,message(body).ifBlank {text(R.string.load_failed)})
                    continuation.resumeWith(Result.success(body.opt("data")))
                } catch(error:Exception) { continuation.resumeWith(Result.failure(error)) }
            }
        }
    }`);
});
fs.writeFileSync(path.join(main,'map/SuspendingViewportCache.kt'),`package cn.llplanet.lowlatitudeplanet.map

import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Waiters are cancellable; replaced viewports never queue blocking synchronized reads. */
internal class SuspendingViewportCache<T>(private val ttlMillis:Long) {
    private val mutex=Mutex()
    private var key=""
    private var area:GeoBounds?=null
    private var value:T?=null
    private var fetchedAt=0L
    @Volatile private var generation=0L
    private var loadedGeneration=-1L
    suspend fun load(identity:String,bounds:GeoBounds,now:()->Long=System::currentTimeMillis,fetch:suspend (GeoBounds)->T):T = mutex.withLock {
        currentCoroutineContext().ensureActive()
        val cached=value
        if(cached!=null&&loadedGeneration==generation&&key==identity&&area?.contains(bounds)==true&&now()-fetchedAt in 0 until ttlMillis)return@withLock cached
        val requestedGeneration=generation
        val coverage=bounds.padded()
        val result=fetch(coverage)
        currentCoroutineContext().ensureActive()
        key=identity;area=coverage;value=result;fetchedAt=now();loadedGeneration=requestedGeneration
        result
    }
    fun clear(){generation++}
}
`);
edit(path.join(main,'map/DashboardState.kt'),s=>{
  s=rep(s,'temporaryQueries=ViewportCache<List<JSONObject>>','temporaryQueries=SuspendingViewportCache<List<JSONObject>>');
  s=rep(s,'val shapes=io { Airspace.temporary(temporaryQueries.load(identity,b){coverage->','val zones=temporaryQueries.load(identity,b){coverage->');
  s=rep(s,'(api.data("/api/no-fly-zones/nearby?"','(api.nearbyMapData("/api/no-fly-zones/nearby?"');
  s=rep(s,'                    }) }\n                    if(current==epoch) temporary=shapes','                    }\n                    val shapes=io { Airspace.temporary(zones) }\n                    if(current==epoch) temporary=shapes');
  return s;
});
fs.writeFileSync(path.join(root,'test/java/cn/llplanet/lowlatitudeplanet/map/SuspendingViewportCacheTest.kt'),`package cn.llplanet.lowlatitudeplanet.map

import kotlinx.coroutines.*
import org.junit.Assert.*
import org.junit.Test

class SuspendingViewportCacheTest {
    private fun box(offset:Double=0.0)=GeoBounds(GeoPoint(31.0+offset,120.0),GeoPoint(31.1+offset,120.1))
    @Test fun concurrentSameCoverageSharesOneSuccessfulQuery()=runBlocking {
        val cache=SuspendingViewportCache<Int>(60000);var calls=0;val gate=CompletableDeferred<Unit>()
        val first=async {cache.load("a",box()){calls++;gate.await();7}}
        yield()
        val next=async {cache.load("a",box(.01)){calls++;8}}
        yield();gate.complete(Unit)
        assertEquals(7,first.await());assertEquals(7,next.await());assertEquals(1,calls)
    }
    @Test fun cancelledWaitersNeverStartObsoleteNetworkQueries()=runBlocking {
        val cache=SuspendingViewportCache<Int>(60000);val gate=CompletableDeferred<Unit>();var staleCalls=0
        val first=async {cache.load("a",box()){gate.await();1}};yield()
        val stale=async {cache.load("a",box(1.0)){staleCalls++;2}};yield();stale.cancelAndJoin()
        gate.complete(Unit);first.await()
        assertEquals(0,staleCalls);assertEquals(3,cache.load("a",box(2.0)){3})
    }
    @Test fun cancelledFetchIsNotCachedAndDoesNotBlockLatest()=runBlocking {
        val cache=SuspendingViewportCache<Int>(60000)
        val old=async {cache.load("a",box()){awaitCancellation()}};yield();old.cancelAndJoin()
        assertEquals(2,cache.load("a",box()){2})
        cache.clear();assertEquals(3,cache.load("a",box()){3})
        assertEquals(4,cache.load("b",box()){4})
    }
}
`);
fs.writeFileSync(path.join(root,'test/java/cn/llplanet/lowlatitudeplanet/data/ReadRequestSignalTest.kt'),`package cn.llplanet.lowlatitudeplanet.data

import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import org.junit.Assert.*
import org.junit.Test

class ReadRequestSignalTest {
    private class Connection:HttpURLConnection(URL("https://example.invalid")) {
        val closed=CountDownLatch(1)
        override fun connect() {}
        override fun usingProxy()=false
        override fun disconnect(){closed.countDown()}
    }
    @Test fun cancellationDisconnectsAttachedSocketAndInvalidatesResult(){
        val signal=ReadRequestSignal();val connection=Connection();signal.attach(connection);signal.cancel()
        assertTrue(connection.closed.await(2,TimeUnit.SECONDS))
        assertThrows(CancellationException::class.java){signal.check()}
    }
    @Test fun cancellationBeforeSocketAttachmentCannotLeakTheSocket(){
        val signal=ReadRequestSignal();val connection=Connection();signal.cancel()
        assertThrows(CancellationException::class.java){signal.attach(connection)}
        assertTrue(connection.closed.await(2,TimeUnit.SECONDS))
    }
}
`);
console.log('Native temporary-zone requests now cancellable; coverage cache waits cancellable.');
