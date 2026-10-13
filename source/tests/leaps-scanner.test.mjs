import { EventEmitter } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventName } from '@stoqey/ib'
import { runCspScan } from '../server/csp-scanner.mjs'
import { scanDate } from '../shared/csp-scan.mjs'
const today = scanDate()
const expiry = days => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400000).toISOString().slice(0,10).replaceAll('-','')
for (const mode of ['iv','leaps']) test(`${mode} scan uses real broker fields, correct universe and cancels subscriptions`, async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ok:true,text:async()=>`Symbol,Security\n${Array.from({length:501},(_,i)=>`SP${i},Company`).join('\n')}`}))
  const subscriptions = new Set(), checked = [], scannerCalls = []
  let disconnected=false
  class Fake extends EventEmitter {
    connect(){queueMicrotask(()=>this.emit(EventName.connected))}
    disconnect(){disconnected=true}
    reqMarketDataType(){}
    reqContractDetails(id,contract){checked.push(contract.symbol);this.emit(EventName.contractDetails,id,{contract:{...contract,conId:1}});this.emit(EventName.contractDetailsEnd,id)}
    reqMktData(id,contract){
      subscriptions.add(id); const stock=contract.secType==='STK'
      const premium=stock ? 110 : contract.lastTradeDateOrContractMonth===expiry(40) ? .5 : 8
      this.emit(EventName.tickPrice,id,1,premium);this.emit(EventName.tickPrice,id,2,premium+.1)
      if(stock)this.emit(EventName.tickGeneric,id,24,.4)
      else this.emit(EventName.tickOptionComputation,id,13,0,.4,-.12,premium,0,0,50,2,110)
    }
    cancelMktData(id){subscriptions.delete(id)}
    reqHistoricalData(id){for(let i=0;i<365;i++)this.emit(EventName.historicalData,id,new Date(Date.parse(`${today}T00:00:00Z`)-i*86400000).toISOString().slice(0,10),0,0,0,i===0?.6:.2);this.emit(EventName.historicalData,id,'finished')}
    cancelHistoricalData(){}
    reqSecDefOptParams(id){this.emit(EventName.securityDefinitionOptionParameter,id,'SMART',1,'HOOD','100',[expiry(40),expiry(400)],[40]);this.emit(EventName.securityDefinitionOptionParameterEnd,id)}
    reqScannerSubscription(id,subscription){scannerCalls.push(subscription);this.emit(EventName.scannerData,id,0,{contract:{symbol:'SP0',secType:'STK',currency:'USD',conId:1}});this.emit(EventName.scannerDataEnd,id)}
    cancelScannerSubscription(){}
  }
  const state={portfolio:[],market:[],rows:[],puts:[],assessments:[],warnings:[],symbolsChecked:0,contractsChecked:0}
  await runCspScan({clientId:77,scanQuoteWaitMs:1},mode==='iv'?[]:['HOOD'],state,Fake,mode)
  assert.equal(state.state,'complete');assert.equal(subscriptions.size,0);assert.equal(disconnected,true)
  if(mode==='iv'){
    assert.equal(state.rows.length,1);assert.ok(state.rows[0].underlyingPrice>50)
    assert.ok(state.rows[0].ivr>40);assert.equal(state.contractsChecked,0)
    assert.equal(scannerCalls.length,2);assert.equal(scannerCalls[0].belowPrice,undefined)
  } else {
    assert.deepEqual(checked,['HOOD']);assert.equal(scannerCalls.length,0)
    assert.equal(state.rows.length,1);assert.equal(state.rows[0].qualifies,true)
    assert.equal(state.rows[0].reference.dte,40);assert.equal(state.rows[0].dte,400)
    assert.equal(state.assessments[0].matches,1)
  }
})
