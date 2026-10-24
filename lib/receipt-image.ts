export const nativeCamera=(agent:string,touches:number)=>/Android|iPhone|iPad|iPod/i.test(agent)||/Macintosh/i.test(agent)&&touches>1;
export async function receiptImage(file:Blob):Promise<string>{
 if(!file.size||file.size>25000000)throw Error('25MB 이하의 사진을 선택해주세요.');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();img.src=url;await img.decode();
  if(!img.naturalWidth||!img.naturalHeight)throw Error('사진을 열 수 없습니다. JPG 사진을 선택해주세요.');
  const scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('사진 변환을 시작하지 못했습니다.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  for(const quality of [.92,.8,.65]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=3400000)return data;}
  throw Error('사진 용량이 큽니다. 시트 부분만 촬영해주세요.');
 }catch(e){throw Error(e instanceof Error&&e.message.includes('사진')?e.message:'사진을 열 수 없습니다. JPG 또는 PNG 사진을 선택해주세요.');}
 finally{URL.revokeObjectURL(url);}
}
