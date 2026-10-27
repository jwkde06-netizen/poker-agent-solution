// Run with the CUA-owned local fixture tab; never against production.
export async function verifyAllGames(tab){
 const check=(ok,message)=>{if(!ok)throw Error(message)};
 const cards=()=>tab.playwright.getByRole('region',{name:/번 게임 참가자$/});
 const expected=['12번 게임 참가자','11번 게임 참가자','10번 게임 참가자','9번 게임 참가자','8번 게임 참가자','1번 게임 참가자'];
 const read=()=>cards().evaluateAll(es=>es.map(e=>({label:e.getAttribute('aria-label'),hidden:e.hidden,display:getComputedStyle(e).display})));
 let rows=await read();check(JSON.stringify(rows.map(r=>r.label))===JSON.stringify(expected),'All fixture IDs must be rendered in descending order');check(rows.every(r=>!r.hidden&&r.display!=='none'),'No hidden cards');
 const search=tab.playwright.getByRole('textbox',{name:'11번 게임 참가자 검색'});
 await search.fill('PLAYER');
 await tab.playwright.getByRole('button',{name:'10번 게임 선택 · 테이블 4',exact:true}).click();
 check(await tab.playwright.getByRole('button',{name:'10번 게임 선택 · 테이블 4',exact:true}).getAttribute('aria-pressed')==='true','Selected shortcut retained');
 check(await tab.playwright.getByRole('region',{name:'10번 게임 참가자',exact:true}).evaluate(e=>document.activeElement===e),'Shortcut focuses target');
 check((await read()).length===expected.length,'Shortcut must not filter cards');
 check(await search.evaluate(e=>e.value)==='PLAYER','Search input survives navigation');
 await tab.playwright.getByRole('button',{name:'10번 PLAYER 10 수정',exact:true}).click();
 return 'PASS all IDs/order, no hidden cards, shortcut selection/focus, search preservation; row editor open for draft check';
}
export async function verifyDraftNavigation(tab){
 await tab.playwright.getByLabel('이름',{exact:true}).fill('UNSAVED PLAYER');
 await tab.playwright.getByRole('button',{name:'9번 게임 선택 · 테이블 3',exact:true}).click();
 if(await tab.playwright.getByLabel('이름',{exact:true}).evaluate(e=>e.value)!=='UNSAVED PLAYER')throw Error('Draft lost');
 if(await tab.playwright.getByRole('region',{name:/번 게임 참가자$/}).count()!==6)throw Error('Cards filtered');
 const stack=tab.playwright.getByLabel('게임별 참가 장부',{exact:true});
 const before=await stack.evaluate(e=>e.scrollTop);
 if(before<=0)throw Error('Shortcut did not scroll');
 return {scroll:before,draft:'UNSAVED PLAYER'};
}
export async function verifyUnknown(tab){
 const cards=tab.playwright.getByRole('region',{name:/번 게임 참가자$/});
 const actual=await cards.evaluateAll(es=>es.filter(e=>!e.hidden&&getComputedStyle(e).display!=='none').map(e=>e.getAttribute('data-game')));
 if(actual.join(',')!=='12,11,10,9,8,1')throw Error('Unknown status hides or misorders games');
 if(await tab.playwright.getByRole('navigation',{name:'게임 바로가기'}).locator('button[data-active=true]').count()!==0)throw Error('Invented active status');
 return 'PASS missing status: all six source games visible, no fabricated active tabs';
}
