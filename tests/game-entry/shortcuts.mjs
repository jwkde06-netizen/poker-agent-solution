// CUA local fixture: after.html?unknown=1&fourteen=1. Never run on production.
export async function verifyShortcuts(tab){
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};
 const nav=tab.playwright.getByRole('navigation',{name:'게임 바로가기'});
 const cards=tab.playwright.getByRole('region',{name:/번 게임 참가자$/});
 const expected=Array.from({length:14},(_,i)=>String(14-i)).join(',');
 check(await nav.getByRole('button').count()===14,'All unknown games need shortcuts');
 check(await nav.locator('button[data-active=true]').count()===0,'Unknown cannot be labelled active');
 check((await cards.evaluateAll(es=>es.filter(e=>!e.hidden&&getComputedStyle(e).display!=='none').map(e=>e.getAttribute('data-game')))).join(',')===expected,'Every worksheet remains visible in descending order');
 await tab.playwright.getByRole('button',{name:'12번 게임 선택 · 테이블 4',exact:true}).click();
 check(await tab.playwright.getByRole('region',{name:'12번 게임 참가자',exact:true}).evaluate(e=>document.activeElement===e),'12 shortcut focuses worksheet');
 check(await cards.count()===14,'Shortcut must not filter');
 await tab.playwright.getByRole('button',{name:'12번 PLAYER 12 수정',exact:true}).click();
 await tab.playwright.getByLabel('이름',{exact:true}).fill('UNSAVED SHORTCUT');
 await tab.playwright.getByRole('button',{name:'11번 게임 선택 · 테이블 3',exact:true}).click();
 check(await tab.playwright.getByLabel('이름',{exact:true}).evaluate(e=>e.value)==='UNSAVED SHORTCUT','Unsaved input lost');
 check(await cards.count()===14,'Draft navigation filters cards');
 return 'PASS 14 unknown shortcuts/cards, descending order, 12 focus, no filtering, unsaved input';
}
export async function verifyTargetClear(tab,number){
 const target=await tab.playwright.getByRole('region',{name:number+'번 게임 참가자',exact:true}).evaluate(e=>e.getBoundingClientRect().top);
 const barBottom=await tab.playwright.getByRole('navigation',{name:'게임 바로가기'}).evaluate(e=>e.parentElement.getBoundingClientRect().bottom);
 if(target<barBottom-1)throw Error('Toolbar obscures target');
 return {targetTop:target,toolbarBottom:barBottom};
}
