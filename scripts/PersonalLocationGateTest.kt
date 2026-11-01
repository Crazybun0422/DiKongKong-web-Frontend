package cn.llplanet.lowlatitudeplanet.data

import org.junit.Assert.*
import org.junit.Test

class PersonalLocationGateTest {
    @Test fun firstFixUploadsAndSuccessfulFixesAreThrottled() {
        val gate=PersonalLocationGate()
        assertTrue(gate.begin("user-a",0));assertFalse(gate.begin("user-a",1000))
        gate.finish("user-a",1000,true)
        assertFalse(gate.begin("user-a",30000));assertTrue(gate.begin("user-a",31000))
    }
    @Test fun failedUploadRetriesOnNextFixAfterBackoff() {
        val gate=PersonalLocationGate()
        assertTrue(gate.begin("user-a",0));gate.finish("user-a",1000,false)
        assertFalse(gate.begin("user-a",4000));assertTrue(gate.begin("user-a",5000))
    }
    @Test fun accountSwitchDoesNotReusePreviousThrottleOrCompletion() {
        val gate=PersonalLocationGate()
        assertTrue(gate.begin("user-a",0));assertTrue(gate.begin("user-b",1))
        gate.finish("user-a",2,true);assertFalse(gate.begin("user-b",5001))
        gate.finish("user-b",5002,false);assertTrue(gate.begin("user-b",5003))
    }
}
