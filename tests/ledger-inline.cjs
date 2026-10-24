const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exports_={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/ledger-inline.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exports_,Error});
const {submitLedgerChange}=exports_;
(async()=>{
 let calls=[],prepared;const send=async b=>{calls.push(b);if(b.action==='preview')return {id:'one'};return {applied:true};};
 assert.equal((await submitLedgerChange(send,{operation:{kind:'buyins',buyins:2},sourceHash:'fresh'},id=>prepared=id)).applied,true);assert.equal(prepared,'one');assert.deepEqual(calls.map(c=>c.action),['preview','apply']);assert.equal(calls[1].id,'one');
 calls=[];await submitLedgerChange(async b=>{calls.push(b);return {applied:true,status:'applied'};},{id:'one'},()=>assert.fail());assert.deepEqual(calls.map(c=>c.action),['result']);
 calls=[];await submitLedgerChange(async b=>{calls.push(b);return b.action==='result'?{status:'writing'}:{applied:true};},{id:'one'},()=>assert.fail());assert.deepEqual(calls.map(c=>c.action),['result','reconcile']);assert(calls.every(c=>c.id==='one'));
 calls=[];await submitLedgerChange(async b=>{calls.push(b);return b.action==='result'?{status:'preview'}:{applied:true};},{id:'one'},()=>assert.fail());assert.deepEqual(calls.map(c=>c.action),['result','apply']);
 calls=[];const failed=await submitLedgerChange(async b=>{calls.push(b);return {status:'failed'};},{id:'one'},()=>assert.fail());assert.equal(failed.failed,true);assert.equal(calls.length,1);
 calls=[];await assert.rejects(()=>submitLedgerChange(async b=>{calls.push(b);if(b.action==='preview')return {id:'two'};throw Error('connection lost');},{operation:{kind:'buyins'}},id=>prepared=id));assert.equal(prepared,'two');assert.equal(calls.length,2);
 console.log('Inline changes: one preview/apply, idempotent result lookup, uncertain reconciliation, same-ID retry and failure guards passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
