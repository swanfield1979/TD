import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createScanStore } from '../server/scan-store.mjs'
const gateway='127.0.0.1:4001'
const row={symbol:'HOOD',underlyingPrice:110,ivr:60,quotedAt:'2026-10-13T12:00:00Z'}
const round=()=>({date:'2026-10-13',cursor:1,entries:[{symbol:'HOOD'},{symbol:'NVDA'}],matches:new Map([['HOOD',row]]),warnings:[],updatedAt:row.quotedAt})
test('scan results and exact resume cursor survive a new store instance; running becomes interrupted',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'tm-scan-store-')), path=join(directory,'scan-results.json')
  try{
    const store=createScanStore(path,gateway)
    assert.equal(await store.load(),null)
    await store.save({iv:{state:'running',phase:'waiting',nextBatchAt:'2026-10-13T12:00:20Z',rows:[row],warnings:[],universeChecked:1},leaps:{state:'complete',rows:[row],warnings:[],finishedAt:row.quotedAt}},round())
    const restored=await createScanStore(path,gateway).load()
    assert.equal(restored.scans.iv.state,'interrupted');assert.equal(restored.scans.iv.restoredFromDisk,true);assert.equal(restored.scans.iv.phase,'interrupted');assert.equal(restored.scans.iv.nextBatchAt,undefined)
    assert.equal(restored.scans.leaps.state,'complete');assert.equal(restored.scans.leaps.rows[0].quotedAt,row.quotedAt)
    assert.equal(restored.round.cursor,1);assert.equal(restored.round.matches.get('HOOD').ivr,60)
  }finally{await rm(directory,{recursive:true,force:true})}
})
test('concurrent saves freeze snapshots and finish in order without truncated JSON',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'tm-scan-store-')), path=join(directory,'scan-results.json')
  try{
    const store=createScanStore(path,gateway), data={iv:{state:'complete',rows:[row],warnings:[]}}, progress=round()
    const first=store.save(data,progress)
    data.iv.rows.push({...row,symbol:'NVDA'});progress.cursor=2;progress.matches.set('NVDA',data.iv.rows[1])
    const second=store.save(data,progress)
    await Promise.all([first,second])
    const saved=await store.load();assert.equal(saved.scans.iv.rows.length,2);assert.equal(saved.round.cursor,2)
    assert.equal(JSON.parse(await readFile(path,'utf8')).version,1)
  }finally{await rm(directory,{recursive:true,force:true})}
})
test('corrupt files and mismatched Gateway are rejected without discarding the existing file',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'tm-scan-store-')), path=join(directory,'scan-results.json')
  try{
    await writeFile(path,'invalid json')
    await assert.rejects(createScanStore(path,gateway).load())
    assert.equal(await readFile(path,'utf8'),'invalid json')
    await createScanStore(path,gateway).save({iv:{state:'complete',rows:[row],warnings:[]}},round())
    await assert.rejects(createScanStore(path,'127.0.0.1:4002').load(),/andere IBKR Gateway/)
  }finally{await rm(directory,{recursive:true,force:true})}
})
