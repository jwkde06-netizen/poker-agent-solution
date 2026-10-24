// Reuse the existing accounting service without moving credentials or ledger data.
const backend='https://dream-poker-reservation.vercel.app/api/accounting/';
export async function accountingProxy(request:Request,resource:'settlement'|'rules'|'ledger'|'scan'){
 const authorization=request.headers.get('authorization');
 if(!authorization||!/^Bearer \S+$/.test(authorization))return Response.json({error:'관리자 계정으로 로그인해주세요.'},{status:403});
 const incoming=new URL(request.url),target=new URL(backend+resource);
 for(const key of ['day','salary','id']){const v=incoming.searchParams.get(key);if(v!==null)target.searchParams.set(key,v);}
 try{
  const body=request.method==='POST'?await request.text():undefined;
  if(body&&body.length>(resource==='scan'?3600000:15000))return Response.json({error:'요청 내용이 너무 길어요.'},{status:413});
  const result=await fetch(target,{method:request.method,headers:{Authorization:authorization,'Content-Type':'application/json'},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(110000)});
  return new Response(await result.text(),{status:result.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch{return Response.json({error:'정산 서비스 연결을 확인하지 못했어요. 잠시 후 다시 시도해주세요.'},{status:503});}
}
