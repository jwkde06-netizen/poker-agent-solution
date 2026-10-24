type Send=(body:any)=>Promise<any>;
export async function submitLedgerChange(send:Send,change:{id?:string;operation?:any;sourceHash?:string},prepared:(id:string)=>void){
 let id=change.id;
 if(id){
  const result=await send({action:'result',id});
  if(result.applied)return result;
  if(result.status==='writing')return send({action:'reconcile',id});
  if(result.status!=='preview')return {applied:false,failed:true};
 }else{
  const plan=await send({action:'preview',operation:change.operation,sourceHash:change.sourceHash});
  if(plan.noop)return {applied:true,noop:true};
  if(typeof plan.id!=='string')throw Error('저장 요청을 확인하지 못했습니다.');
  id=plan.id;prepared(id);
 }
 return send({action:'apply',id});
}
