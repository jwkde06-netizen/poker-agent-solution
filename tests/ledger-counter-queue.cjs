const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const out={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/ledger-counter-queue.ts','utf8'),{compilerOptions:{module:1,target:7}}).outputText,{exports:out,setTimeout,clearTimeout,Error,Map,Array,Number,Object});
const {LedgerCounterQueue}=out;const wait=ms=>new Promise(r=>setTimeout(r,ms));
const row={row:2,game:12,table:'13-4',blind:'5M',player:'PLAYER',buyins:1};
(async()=>{
 let entries=[],calls=[],resolvers=[];
 const q=new LedgerCounterQueue({delay:1,change:x=>entries=x,error:()=>assert.fail(),save:(r,n)=>{calls.push([r.buyins,n]);return new Promise(resolve=>resolvers.push(()=>resolve({...r,buyins:n})));}});
 q.change(row,1);assert.equal(entries[0].target,2);q.change(row,1);assert.equal(entries[0].target,3);
 await wait(10);assert.deepEqual(calls,[[1,3]]);q.change(row,1);assert.equal(entries[0].target,4);resolvers.shift()();await wait(10);assert.deepEqual(calls,[[1,3],[3,4]]);resolvers.shift()();await wait(10);assert.equal(q.pending,false);
 q.change({...row,buyins:4},-1);assert.equal(entries[0].target,3);await wait(10);resolvers.shift()();await wait(10);assert.equal(q.pending,false);
 let errors=[];const failed=new LedgerCounterQueue({delay:1,change:x=>entries=x,error:(r,e)=>errors.push(e),save:async()=>{throw Error('rejected')}});failed.change(row,1);await wait(10);assert.equal(failed.pending,false);assert.equal(entries.length,0);assert.equal(errors.length,1);
 let attempts=0;const unknown=new LedgerCounterQueue({delay:1,change:x=>entries=x,error:(r,e)=>errors.push(e),save:async(r,n)=>{attempts++;if(attempts===1)throw Object.assign(Error('timeout'),{uncertain:true});return {...r,buyins:n};}});
 unknown.change(row,1);await wait(10);assert.equal(entries[0].stage,'uncertain');unknown.change(row,1);assert.equal(attempts,1);assert.equal(unknown.reconcile({...row,buyins:9}),false);assert.equal(unknown.reconcile({...row,buyins:2}),true);await wait(10);assert.equal(unknown.pending,false);assert.equal(attempts,1);
 let running=0,maxRunning=0;const serial=new LedgerCounterQueue({delay:1,change:()=>{},error:()=>assert.fail(),save:async(r,n)=>{running++;maxRunning=Math.max(maxRunning,running);await wait(5);running--;return {...r,buyins:n};}});serial.change(row,1);serial.change({...row,row:3,player:'SECOND'},1);await wait(30);assert.equal(maxRunning,1);assert.equal(serial.pending,false);
 const noop=new LedgerCounterQueue({delay:1,change:()=>{},error:()=>assert.fail(),save:()=>assert.fail()});noop.change(row,1);noop.change(row,-1);await wait(10);assert.equal(noop.pending,false);
 console.log('Counter queue: immediate targets, rapid clicks, in-flight clicks, direct decrement, rollback, uncertain pause/readback, serial writes and net-zero coalescing passed');
})().catch(e=>{console.error(e);process.exitCode=1});
