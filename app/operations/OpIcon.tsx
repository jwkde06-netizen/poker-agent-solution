export default function OpIcon({name}:{name:string}){
 const paths:Record<string,React.ReactNode>={
  overview:<><rect x='3' y='3' width='7' height='7' rx='2'/><rect x='14' y='3' width='7' height='7' rx='2'/><rect x='3' y='14' width='7' height='7' rx='2'/><rect x='14' y='14' width='7' height='7' rx='2'/></>,
  calendar:<><rect x='3' y='5' width='18' height='16' rx='3'/><path d='M7 3v4m10-4v4M3 11h18m-13 5h3'/></>,
  rules:<><rect x='4' y='3' width='16' height='18' rx='3'/><path d='M8 8h8m-8 4h8m-8 4h5'/></>,
  cards:<><rect x='5' y='3' width='14' height='18' rx='3'/><path d='m12 8 3 4-3 4-3-4Z'/></>,
  cup:<><path d='M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Zm12 1h2a3 3 0 1 1 0 6h-2M4 22h14M7 3v2m5-2v2'/></>,
  link:<><path d='m10 14 4-4m-5 6-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0'/></>,
  arrow:<path d='M5 12h14m-5-5 5 5-5 5'/>,
 };
 return <svg aria-hidden='true' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.65' strokeLinecap='round' strokeLinejoin='round'>{paths[name]||paths.rules}</svg>;
}
