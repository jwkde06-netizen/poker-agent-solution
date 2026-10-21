'use client';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import OpIcon from './OpIcon';
import s from './operations.module.css';
export default function OpsShell({children}:{children:React.ReactNode}){
 const path=usePathname();
 const links=[['/operations','overview','운영 홈'],['/operations/weekly','calendar','드림 주간정산'],['/operations/rules','rules','드림 업무 규칙']];
 return <div className={s.shell}><aside className={s.sidebar}><Link href='/operations' className={s.logo}><span className={s.mark}>P<span>·</span></span><span>POKER OPS<small>운영을 더 간결하게.</small></span></Link><span className={s.navLabel}>WORKSPACE</span><nav>{links.map(([href,icon,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined} className={path===href?s.active:''}><OpIcon name={icon}/>{label}</Link>)}</nav><div className={s.sideBottom}><span className={s.navLabel}>기존 솔루션</span><a href='/?tab=players'>선수 관리 <span>↗</span></a><a href='/?tab=expenses'>지출·상계 관리 <span>↗</span></a><a href='/?tab=settings'>계정·권한 관리 <span>↗</span></a><p>기존 관리 데이터는 유지됩니다.<br/>정산 원본은 연결된 시트입니다.</p></div></aside><div className={s.main}><div className={s.topbar}><span>통합 운영 워크스페이스</span><span className={s.topTag}><i/> Google Sheets 기반</span></div>{children}</div><nav className={s.mobileNav}>{links.map(([href,icon,label])=><Link key={href} href={href} aria-current={path===href?'page':undefined}><OpIcon name={icon}/><span>{label}</span></Link>)}</nav></div>;
}
