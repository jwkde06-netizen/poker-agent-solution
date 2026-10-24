export type CounterEntry={key:string;row:any;target:number;sent?:number;stage:'queued'|'saving'|'uncertain'};
export const counterKey=(r:any)=>[r.row,r.game,r.table,r.blind,r.player].join('|');
type Options={save:(row:any,target:number)=>Promise<any>;change:(entries:CounterEntry[])=>void;error:(row:any,error:any)=>void;delay?:number};
// One writer, immediate local targets, and coalesced clicks. Never replay an uncertain write.
export class LedgerCounterQueue{
 private entries=new Map<string,CounterEntry>();private timer:ReturnType<typeof setTimeout>|undefined;private running=false;private paused=false;
 constructor(private options:Options){}
 get pending(){return this.entries.size>0;}
 private emit(){this.options.change(Array.from(this.entries.values()).map(e=>({...e})));}
 change(row:any,delta:number){
  if(this.paused)return;
  const k=counterKey(row),entry=this.entries.get(k)||{key:k,row,target:Number(row.buyins),stage:'queued' as const};
  const target=entry.target+delta;if(!Number.isInteger(target)||target<1||target>50)return;
  entry.target=target;this.entries.set(k,entry);this.emit();
  if(!this.running){clearTimeout(this.timer);this.timer=setTimeout(()=>void this.drain(),this.options.delay??160);}
 }
 private async drain(){
  if(this.running||this.paused)return;this.running=true;
  try{while(this.entries.size&&!this.paused){
   const entry=Array.from(this.entries.values())[0];
   if(entry.target===Number(entry.row.buyins)){this.entries.delete(entry.key);this.emit();continue;}
   entry.stage='saving';entry.sent=entry.target;this.emit();
   try{
    const row=await this.options.save(entry.row,entry.sent);
    if(counterKey(row)!==entry.key||Number(row.buyins)!==entry.sent)throw Object.assign(Error('저장 결과를 확인해주세요.'),{uncertain:true});
    entry.row=row;
    if(entry.target===entry.sent)this.entries.delete(entry.key);else entry.stage='queued';
   }catch(error:any){
    if(error?.uncertain){entry.stage='uncertain';this.paused=true;}
    else this.entries.delete(entry.key);
    this.options.error(entry.row,error);
   }
   this.emit();
  }}finally{this.running=false;}
 }
 reconcile(row:any){
  const entry=this.entries.get(counterKey(row));if(!entry||entry.stage!=='uncertain'||Number(row.buyins)!==entry.sent)return false;
  entry.row=row;if(entry.target===entry.sent)this.entries.delete(entry.key);else entry.stage='queued';
  this.paused=false;this.emit();void this.drain();return true;
 }
 dispose(){clearTimeout(this.timer);}
}
