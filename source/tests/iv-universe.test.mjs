import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { EventName } from '@stoqey/ib'
import { parseNasdaq, parseSp500, combineUniverse, loadIvUniverse, SP500_URL, NASDAQ_URL } from '../server/iv-universe.mjs'
import { runCspScan } from '../server/csp-scanner.mjs'
import { resetScanGuards } from '../server/scan-guard.mjs'
import { scanDate } from '../shared/csp-scan.mjs'
const header='Symbol|Security Name|Test Issue|ETF'
test('public lists exclude funds, tests, warrants and units; index members come first and are deduplicated',()=>{
  const nasdaq=parseNasdaq(`${header}\nHOOD|Robinhood Common Stock|N|N\nNVDA|Nvidia Common Stock|N|N\nQQQ|ETF Common Stock|N|Y\nTEST|Common Stock|Y|N\nWARRANT|Ordinary Shares Warrants|N|N\nUNIT|Common Stock Units|N|N\nFile Creation Time: 10132026|||`)
  assert.deepEqual(nasdaq,['HOOD','NVDA'])
  const sp=parseSp500('Symbol,Security\nNVDA,Nvidia\nBRK.B,Berkshire')
  assert.deepEqual(sp,['NVDA','BRK B'])
  assert.deepEqual(combineUniverse(sp,nasdaq),[{symbol:'BRK B',universe:'S&P 500'},{symbol:'NVDA',universe:'NASDAQ · S&P 500'},{symbol:'HOOD',universe:'NASDAQ'}])
  assert.throws(()=>parseNasdaq('<html>error</html>'))
  assert.throws(()=>parseSp500('<html>error</html>'))
})
test('one missing list is disclosed; unavailable or truncated feeds never become a successful empty scan',async t=>{
  t.mock.method(globalThis,'fetch',async url=>url===SP500_URL?{ok:true,text:async()=>`Symbol,Security\n${Array.from({length:501},(_,i)=>`SP${i},Company`).join('\n')}`}:{ok:false,status:503})
  const data=await loadIvUniverse()
  assert.equal(data.entries.length,501);assert.equal(data.warnings.length,1)
  t.mock.method(globalThis,'fetch',async()=>({ok:true,text:async()=>'<html>error</html>'}))
  await assert.rejects(loadIvUniverse(),/Geen aandelenlijst beschikbaar/)
})
test('IV Scan checks list batches without any IBKR scanner call, resumes and retains earlier matches',async()=>{
  resetScanGuards()
  const today=scanDate(), checked=[], active=new Set()
  let downloads=0
  class Fake extends EventEmitter {
    connect(){queueMicrotask(()=>this.emit(EventName.connected))}
    disconnect(){}
    reqMarketDataType(){}
    reqContractDetails(id,contract){checked.push(contract.symbol);this.emit(EventName.contractDetails,id,{contract:{...contract,conId:checked.length}});this.emit(EventName.contractDetailsEnd,id)}
    reqMktData(id,contract){active.add(id);this.emit(EventName.tickPrice,id,1,100);this.emit(EventName.tickPrice,id,2,101);if(contract.symbol !== 'SP55')this.emit(EventName.tickGeneric,id,24,.4)}
    cancelMktData(id){active.delete(id)}
    reqHistoricalData(id){downloads++;for(let i=0;i<365;i++)this.emit(EventName.historicalData,id,new Date(Date.parse(`${today}T00:00:00Z`)-i*86400000).toISOString().slice(0,10),0,0,0,i===0?.6:.2);this.emit(EventName.historicalData,id,'finished')}
    cancelHistoricalData(){}
    reqScannerSubscription(){throw new Error('Disabled scanners must not be called')}
  }
  const entries=Array.from({length:56},(_,i)=>({symbol:`SP${i}`,universe:'S&P 500'}))
  let loads=0
  const config={clientId:77,scanQuoteWaitMs:1,scanPacer:{acquire:async()=>{}},ivUniverseLoader:async()=>{loads++;return{entries,warnings:[],updatedAt:new Date().toISOString()}}}
  const state=()=>({rows:[],portfolio:[],market:[],warnings:[],symbolsChecked:0,contractsChecked:0})
  const first=state();await runCspScan(config,[],first,Fake,'iv')
  assert.equal(first.symbolsChecked,25);assert.equal(first.universeChecked,25);assert.equal(first.remainingSymbols,31);assert.equal(first.rows.length,25)
  const second=state();await runCspScan(config,[],second,Fake,'iv')
  assert.equal(second.symbolsChecked,25);assert.equal(second.universeChecked,50);assert.equal(second.rows.length,50)
  const third=state();await runCspScan(config,[],third,Fake,'iv')
  assert.equal(third.symbolsChecked,6);assert.equal(third.remainingSymbols,0);assert.equal(third.rows.length,55);assert.equal(third.state,'partial');assert.match(third.warnings[0],/Actuele IV ontbreekt/)
  assert.equal(new Set(checked).size,56);assert.equal(loads,1);assert.equal(downloads,55);assert.equal(active.size,0)
})
