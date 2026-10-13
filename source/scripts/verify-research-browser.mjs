import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const page = await browser.newPage({viewport:{width:1440,height:1000}})
const errors=[]
page.on('pageerror', error=>errors.push(error.message))
let symbols=[], failure=false
const quote={symbol:'HOOD',underlyingPrice:110,ivr:55,ivPercentile:65,iv:60,marketDataType:3,quotedAt:new Date().toISOString(),universe:'NASDAQ'}
const reference={expiry:'20261120',dte:40,strike:85,absoluteDelta:.12,annualizedYield:5}
const candidate={...quote,id:'HOOD:long',expiry:'20280121',dte:465,strike:40,absoluteDelta:.12,bid:8,ask:8.5,premium:800,collateral:4000,breakEven:32,buffer:70.91,annualizedYield:15.7,reference,qualifies:true,yieldAdvantage:10.7,exitPrice:4}
const noMatch={...candidate,id:'HOOD:no-match',strike:50,qualifies:false,reference:null,yieldAdvantage:null}
const results={iv:{state:'idle',rows:[],warnings:[],symbolsChecked:0,contractsChecked:0},leaps:{state:'idle',rows:[],warnings:[],symbolsChecked:0,contractsChecked:0}}
await page.route('**/api/**',async route=>{
  const request=route.request(), path=new URL(request.url()).pathname
  let body={},status=200
  if(path==='/api/leaps/shortlist'){
    if(request.method()==='PUT') symbols=request.postDataJSON().symbols
    body={symbols}
  } else if(path==='/api/iv-scan'||path==='/api/leaps'){
    const mode=path==='/api/iv-scan'?'iv':'leaps'
    if(request.method()==='POST'){
      if(failure){status=503;body={message:'Marktdata niet bereikbaar; probeer opnieuw.'}}
      else results[mode]={state:'partial',rows:mode==='iv'?[quote]:[candidate,noMatch],warnings:['NVDA: IV-historie ontbreekt; overgeslagen.'],symbolsChecked:2,contractsChecked:6,finishedAt:new Date().toISOString(),assessments:[{symbol:'HOOD',matches:1,message:'Passende Leaps gevonden'}]}
    }
    if(status===200)body=results[mode]
  } else if(path==='/api/ibkr/status')body={state:'offline',message:'Testverbinding',isBusy:false}
  else status=404
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
})
await page.goto(`${process.env.RESEARCH_URL||'http://127.0.0.1:5199'}/#breakout`)
await page.getByRole('heading',{name:'IV Scan',exact:true}).waitFor()
assert.equal(await page.getByRole('link',{name:'Breakout',exact:true}).count(),0)
await page.getByRole('button',{name:'Scan starten',exact:true}).click()
await page.getByRole('button',{name:'Toevoegen aan Leaps'}).click()
assert.deepEqual(symbols,['HOOD'])
await page.getByRole('link',{name:'Leaps',exact:true}).click()
await page.getByRole('heading',{name:'Mijn shortlist'}).waitFor()
await page.getByLabel('Tickers toevoegen').fill('NVDA, COIN')
await page.getByRole('button',{name:'Toevoegen',exact:true}).click()
await page.getByRole('button',{name:'COIN verwijderen uit shortlist'}).waitFor()
assert.deepEqual(symbols,['HOOD','NVDA','COIN'])
await page.getByRole('button',{name:'COIN verwijderen uit shortlist'}).click()
await page.getByRole('button',{name:'Scan starten',exact:true}).click()
await page.getByRole('cell',{name:'Voldoet',exact:true}).waitFor()
assert.equal(await page.locator('tbody tr').count(),1)
await page.getByLabel('Alleen passende kandidaten').uncheck()
assert.equal(await page.locator('tbody tr').count(),2)
await page.getByLabel('Ticker zoeken').fill('ZZZ')
assert.equal(await page.locator('tbody tr').count(),0)
await page.getByRole('button',{name:'Zoekfilter wissen'}).click()
await page.getByLabel('Alleen passende kandidaten').check()
await mkdir('data/private/research-validation',{recursive:true})
await page.screenshot({path:'data/private/research-validation/leaps-desktop.png',fullPage:true})
for(const width of [360,768,1024,1440]){
  await page.setViewportSize({width,height:1000})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No page overflow at ${width}`)
}
await page.setViewportSize({width:360,height:900})
await page.waitForFunction(() => document.querySelector('.side-nav').getBoundingClientRect().right <= 0)
await page.screenshot({path:'data/private/research-validation/leaps-mobile.png',fullPage:true})
await page.reload()
await page.getByRole('button',{name:'HOOD verwijderen uit shortlist'}).waitFor()
assert.deepEqual(symbols,['HOOD','NVDA'])
failure=true
await page.getByRole('button',{name:'Scan starten',exact:true}).click()
await page.getByRole('alert').waitFor()
assert.match(await page.getByRole('alert').innerText(),/Marktdata niet bereikbaar/)
assert.deepEqual(errors,[])
console.log('IV Scan / Leaps browserworkflow geslaagd: navigatie, toevoegen, verwijderen, bewaren, vergelijking, filters, fouten en 360/768/1024/1440px. Marktdata is een expliciete testfixture.')
await browser.close()
