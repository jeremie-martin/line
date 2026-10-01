/** Search distance to a frozen functional check, never a relaxed acceptance gate. */
export function constructionDeficit(check:{fulfilled:boolean;reasons:string[];transfer?:{
 freeBetween:number;uncoveredReceivingFrames:number;receivingClearance:number;engagedTurns:number;contactTurning:number;contactReversals:number}}):number{
 if(check.fulfilled)return 0;
 const t=check.transfer;
 if(!t)return check.reasons.length;
 let loss=check.reasons.filter(r=>!['missing-separated-transfer','missing-engaged-transfer-corners','missing-engaged-transfer-reversals'].includes(r)).length;
 if(check.reasons.includes('missing-separated-transfer'))loss+=Math.max(0,1-t.freeBetween)+Math.max(0,2-t.uncoveredReceivingFrames)/2+Math.max(0,6-t.receivingClearance)/6;
 if(check.reasons.includes('missing-engaged-transfer-corners'))loss+=Math.max(0,2-t.engagedTurns);
 if(check.reasons.includes('missing-engaged-transfer-reversals'))loss+=Math.max(0,20-t.contactTurning)/20+Math.max(0,1-t.contactReversals);
 return Math.max(.01,loss);
}
