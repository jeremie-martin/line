import {describe, expect, it} from 'vitest';
import {overlayImpactContacts} from '../scripts/produce/overlay_impact.ts';
import {traumaAt} from '../remotion/src/impact.ts';

describe('saved production impacts in the video overlay', () => {
  it('preserves one-to-one matches and missing targets, without nearest-landing reuse', () => {
    const contacts=overlayImpactContacts({
      targets:[{frame:40,impact:.8},{frame:41,impact:.6}],
      events:[{onset:42,strength:.7}],
      account:{matches:[{target:0,event:0,strengthError:-.1}]},
    } as Parameters<typeof overlayImpactContacts>[0]);
    expect(contacts[0]).toEqual({t:1,actualTime:1.05,landed:true,impactTarget:.8,
      impactError:.1,impactMeasured:.7,impactRawPxPerFrame:null});
    expect(contacts[1]).toEqual({t:1.025,actualTime:null,landed:false,impactTarget:.6,
      impactError:null,impactMeasured:null,impactRawPxPerFrame:null});
  });
  it('does not turn an invalid saved event reference into a missing target', () => {
    expect(()=>overlayImpactContacts({targets:[{frame:40,impact:.8}],events:[],
      account:{matches:[{target:0,event:2,strengthError:0}]},
    } as Parameters<typeof overlayImpactContacts>[0])).toThrow('missing event');
  });
  it('times effects at the measured onset instead of the requested time', () => {
    const contacts=[{t:1,actualTime:1.05,impactMeasured:.7}];
    const config={decayPerSec:2,gain:1,minImpact:.2,power:1};
    expect(traumaAt(1,contacts,config)).toBe(0);
    expect(traumaAt(1.05,contacts,config)).toBe(.7);
    expect(traumaAt(1.55,contacts,config)).toBeCloseTo(.7*Math.exp(-1));
  });
});
