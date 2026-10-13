import test from 'node:test'
import assert from 'node:assert/strict'
import { ScanPacer, pacingError, disabledScanner } from '../server/scan-guard.mjs'
test('requests are serialized with minimum spacing and rolling historical budget', async()=>{
  let now=0
  const sleeps=[]
  const pacer=new ScanPacer({interval:500,historyInterval:11000,historyLimit:2,historyWindow:60000,now:()=>now,wait:async ms=>{sleeps.push(ms);now+=ms}})
  await Promise.all([pacer.acquire(),pacer.acquire(),pacer.acquire()])
  assert.equal(now,1000);assert.deepEqual(sleeps,[500,500])
  await pacer.acquire({historical:true,key:'A'})
  const first=now
  await pacer.acquire({historical:true,key:'B'});assert.equal(now-first,11000)
  await pacer.acquire({historical:true,key:'C'});assert.equal(now-first,60000)
})
test('identical history waits 15 seconds; cancellation does not consume another request', async()=>{
  let now=0
  const pacer=new ScanPacer({interval:500,historyInterval:11000,now:()=>now,wait:async ms=>{now+=ms}})
  await pacer.acquire({historical:true,key:'A'});await pacer.acquire({historical:true,key:'A'})
  assert.equal(now,15000)
  const controller=new AbortController();controller.abort()
  await assert.rejects(pacer.acquire({signal:controller.signal}),/abort/i)
  assert.equal(pacer.last,15000)
})
test('disabled scanner error is distinguished from pacing limits',()=>{
  assert.equal(disabledScanner('Scanner type with code 2 is disabled.'),true)
  assert.equal(pacingError(162,'Scanner type with code 2 is disabled.'),false)
  assert.equal(pacingError(162,'Historical data request pacing violation'),true)
  assert.equal(pacingError(100,'Max rate exceeded'),true)
  assert.equal(pacingError(420,'Invalid real-time query'),true)
})
