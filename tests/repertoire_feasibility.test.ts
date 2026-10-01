import {it,expect} from 'vitest';
import {constructionDeficit} from '../scripts/v0/optimizer/repertoire_feasibility.ts';
it('ranks repair progress without treating a near miss as fulfilled',()=>{
 const missing={fulfilled:false,reasons:['missing-separated-transfer','missing-engaged-transfer-corners'],transfer:{freeBetween:0,uncoveredReceivingFrames:0,receivingClearance:0,engagedTurns:0,contactTurning:0,contactReversals:0}};
 const progress={...missing,transfer:{...missing.transfer,freeBetween:1,engagedTurns:1,receivingClearance:4}};
 expect(constructionDeficit(progress)).toBeLessThan(constructionDeficit(missing));
 expect(constructionDeficit({...missing,reasons:[],transfer:{...progress.transfer,engagedTurns:2,uncoveredReceivingFrames:2,receivingClearance:6}})).toBeGreaterThan(0);
 expect(constructionDeficit({...missing,fulfilled:true,reasons:[]})).toBe(0);
});
