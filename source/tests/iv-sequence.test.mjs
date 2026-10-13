import test from 'node:test'
import assert from 'node:assert/strict'
import { runIvSequence, IV_BATCH_PAUSE_MS } from '../server/iv-sequence.mjs'
const makeState=()=>({state:'running',rows:[],warnings:[],symbolsChecked:0,contractsChecked:0})
const start=Date.parse('2026-10-13T12:00:00Z')
test('automatic IV scan processes 25/25/remainder, waits 20 seconds and ends without a new round',async()=>{
  const state=makeState(), pauses=[], checkpoints=[]
  let clock=start,calls=0
  await runIvSequence(state,{
    now:()=>new Date(clock),
    runBatch:async()=>{calls++;state.roundDate='2026-10-13';state.state='partial';state.universeCount=56;state.universeChecked=Math.min(calls*25,56);state.remainingSymbols=56-state.universeChecked;state.rows.push({symbol:`MATCH${calls}`});state.warnings.push('Missing quote')},
    wait:async ms=>{pauses.push(ms);clock+=ms},
    checkpoint:async()=>{checkpoints.push({...state})},
  })
  assert.equal(calls,3);assert.deepEqual(pauses,[20000,20000]);assert.equal(IV_BATCH_PAUSE_MS,20000)
  assert.equal(state.state,'partial');assert.equal(state.remainingSymbols,0);assert.equal(state.rows.length,3)
  assert.equal(state.batchesCompleted,3);assert.deepEqual(state.warnings,['Missing quote']);assert.equal(state.nextBatchAt,undefined)
  assert.equal(checkpoints.filter(checkpoint=>checkpoint.phase==='waiting'&&checkpoint.state==='running').length,2)
})
test('stop during the inter-batch pause cancels continuation and retains results',async()=>{
  const state=makeState(), controller=new AbortController()
  let calls=0
  await runIvSequence(state,{
    signal:controller.signal,now:()=>new Date(start),
    runBatch:async()=>{calls++;Object.assign(state,{state:'complete',remainingSymbols:25,rows:[{symbol:'HOOD'}]})},
    wait:async(ms,signal)=>{controller.abort();signal.throwIfAborted()},
  })
  assert.equal(calls,1);assert.equal(state.state,'cancelled');assert.equal(state.rows[0].symbol,'HOOD');assert.equal(state.nextBatchAt,undefined)
})
test('a broker error stops automatic continuation instead of retrying after 20 seconds',async()=>{
  const state=makeState()
  let calls=0,waits=0
  await runIvSequence(state,{runBatch:async()=>{calls++;state.state='error';state.message='IBKR pacing violation'},wait:async()=>waits++})
  assert.equal(calls,1);assert.equal(waits,0);assert.equal(state.state,'error');assert.match(state.message,/pacing/)
})
test('automatic scan finishes the loaded universe across midnight and stops when persistence fails',async()=>{
  for(const failure of ['new-day','storage']){
    const state=makeState();let clock=start,calls=0
    await runIvSequence(state,{
      now:()=>new Date(clock),runBatch:async()=>{calls++;Object.assign(state,{state:'complete',remainingSymbols:calls === 1 ? 25 : 0,roundDate:'2026-10-13'})},
      checkpoint:async()=>{if(failure==='storage')state.storageError='Read-only directory'},
      wait:async()=>{clock+=86400000},
    })
    assert.equal(calls,failure==='storage'?1:2);assert.equal(state.state,failure==='storage'?'error':'complete')
  }
})
