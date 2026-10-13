import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createServer } from 'node:net'
const pause = ms => new Promise(resolve => setTimeout(resolve,ms))
test('API persists manual shortlist across restart, validates edits and starts scan from saved symbols', {timeout:20000}, async()=>{
  const directory=await mkdtemp(join(tmpdir(),'tm-leaps-test-'))
  const portServer=createServer().listen(0,'127.0.0.1'); await once(portServer,'listening')
  const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve))
  let child
  const origin=`http://127.0.0.1:${port}`
  const headers={Origin:origin,'X-Requested-With':'trading-monitor','Content-Type':'application/json'}
  const start=async()=>{
    child=spawn(process.execPath,['server/ibkr-api.mjs'],{env:{...process.env,IBKR_API_PORT:String(port),IBKR_API_HOST:'127.0.0.1',IBKR_ALLOWED_ORIGINS:origin,IBKR_PORT:'1',IBKR_SNAPSHOT_PATH:join(directory,'snapshot.json')},stdio:'ignore'})
    for(let i=0;i<100;i++) {try{const res=await fetch(`${origin}/api/leaps/shortlist`);if(res.ok)return}catch{}await pause(30)}
    throw new Error('Test API did not start')
  }
  const stop=async()=>{const exited=once(child,'exit');child.kill();await exited}
  try{
    await start()
    assert.deepEqual(await (await fetch(`${origin}/api/leaps/shortlist`)).json(),{symbols:[],message:null})
    assert.equal((await fetch(`${origin}/api/leaps`,{method:'POST',headers})).status,400)
    assert.equal((await fetch(`${origin}/api/leaps/shortlist`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbols:['HOOD']})})).status,403)
    const saved=await fetch(`${origin}/api/leaps/shortlist`,{method:'PUT',headers,body:JSON.stringify({symbols:[' hood ','NVDA','HOOD']})})
    assert.equal(saved.status,200);assert.deepEqual((await saved.json()).symbols,['HOOD','NVDA'])
    assert.deepEqual(JSON.parse(await readFile(join(directory,'leaps-shortlist.json'),'utf8')),['HOOD','NVDA'])
    assert.equal((await fetch(`${origin}/api/leaps/shortlist`,{method:'PUT',headers,body:JSON.stringify({symbols:['../../invalid']})})).status,400)
    await stop();await start()
    assert.deepEqual((await (await fetch(`${origin}/api/leaps/shortlist`)).json()).symbols,['HOOD','NVDA'])
    const scan=await fetch(`${origin}/api/leaps`,{method:'POST',headers});assert.equal(scan.status,202)
    assert.deepEqual((await scan.json()).symbols,['HOOD','NVDA'])
    assert.equal((await fetch(`${origin}/api/iv-scan`,{method:'POST',headers})).status,409)
    assert.equal((await fetch(`${origin}/api/scans`,{method:'POST',headers})).status,409)
  }finally{if(child?.exitCode===null)await stop();await rm(directory,{recursive:true,force:true})}
})
