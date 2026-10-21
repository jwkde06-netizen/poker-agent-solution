const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
function compile(path,context={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,...context});return exports;}
const rooms=compile('lib/operations-rooms.ts');assert.equal(rooms.rooms.length,4);assert.equal(rooms.roomActions('dream').length,4);for(const id of ['mm','taiwan','philippines','arbitrary'])assert.equal(rooms.roomActions(id).length,0);
let calls=[];const proxy=compile('lib/operations-proxy.ts',{URL,Response,AbortSignal,fetch:async(url,init)=>{calls.push({url:String(url),init});return new Response(JSON.stringify({ok:true}),{status:200});}});
(async()=>{
 const unauth=await proxy.accountingProxy(new Request('https://poker-agent-solution.vercel.app/api/operations/settlement'),'settlement');assert.equal(unauth.status,403);assert.equal(calls.length,0);
 const get=await proxy.accountingProxy(new Request('https://poker-agent-solution.vercel.app/api/operations/settlement?day=2026-10-21&url=https://evil.test&room=mm',{headers:{Authorization:'Bearer test'}}),'settlement');assert.equal(get.status,200);
 assert.equal(calls[0].url,'https://dream-poker-reservation.vercel.app/api/accounting/settlement?day=2026-10-21');assert.equal(calls[0].init.redirect,'error');assert.equal(get.headers.get('cache-control'),'no-store');
 const tooLarge=await proxy.accountingProxy(new Request('https://poker-agent-solution.vercel.app/api/operations/rules',{method:'POST',headers:{Authorization:'Bearer test'},body:'x'.repeat(10001)}),'rules');assert.equal(tooLarge.status,413);assert.equal(calls.length,1);
 console.log('Room isolation, authorized fixed-origin proxy, query allowlist, no-store and request-size checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
