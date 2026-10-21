import OpsShell from './OpsShell';
export const metadata={title:'Poker Ops · 통합 운영',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <OpsShell>{children}</OpsShell>;}
