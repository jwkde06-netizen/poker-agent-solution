import {accountingProxy} from '../../../../lib/operations-proxy';
export const dynamic='force-dynamic';export const maxDuration=120;
export const GET=(r:Request)=>accountingProxy(r,'ledger');
export const POST=(r:Request)=>accountingProxy(r,'ledger');
