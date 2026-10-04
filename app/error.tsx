"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{
      minHeight:"100vh",
      display:"grid",
      placeItems:"center",
      padding:"24px",
      background:"#f4f5f7",
      color:"#202327"
    }}>
      <section style={{
        width:"min(420px,100%)",
        background:"#fff",
        border:"1px solid #e3e6e8",
        borderRadius:"18px",
        padding:"24px",
        boxShadow:"0 16px 40px rgba(20,24,28,.08)"
      }}>
        <h1 style={{margin:"0 0 8px",fontSize:"22px"}}>화면을 불러오지 못했습니다.</h1>
        <p style={{margin:"0 0 18px",lineHeight:1.6,color:"#727981",fontSize:"14px"}}>
          잠시 후 다시 시도해주세요. 입력 중인 데이터는 서버에 저장된 내용에 영향을 주지 않습니다.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
          <button onClick={reset} style={{height:"44px",border:"0",borderRadius:"10px",background:"#c99631",color:"#111",fontWeight:800,cursor:"pointer"}}>
            다시 시도
          </button>
          <button onClick={()=>window.location.reload()} style={{height:"44px",border:"1px solid #d8dce0",borderRadius:"10px",background:"#fff",color:"#333",fontWeight:700,cursor:"pointer"}}>
            새로고침
          </button>
        </div>
        {process.env.NODE_ENV==="development" && (
          <pre style={{marginTop:"16px",whiteSpace:"pre-wrap",fontSize:"11px",color:"#a33"}}>{error.message}</pre>
        )}
      </section>
    </main>
  );
}
