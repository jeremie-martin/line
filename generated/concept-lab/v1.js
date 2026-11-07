// The settled v1: the default for every look and question, chosen over rounds 1–19 (LEDGER.md has the owner's words per piece).
// One source of truth. lab.js builds `base` from this; a production port should start here. The values are option keys of lab.js
// (DIMS); the formulas they select are documented next to them in lab.js (RESP, cam.js PLACEMENTS).
export const V1 = {
  // ── camera ── Follows direction: the rider's height follows the slope it rides (sine squared) and never climbs on screen
  // while descending; median height 38 % of the screen (R6–R7). 15 % closer (R4). A steady zoom (R4). Whole course at both
  // ends, the band there from the first frame (R1, R4).
  place: 'follow', size: 's62', tide: 'steady', ends: 'overture', bandIn: 'present',

  // ── line ── pencil → ink, inked as the rider passes (R1, R5). Whole rail and all ink are alternatives (R5–R6); Old Rose all ink (R12).
  ink: 'inking',

  // ── band ── low-middle (R3). The questions use bars with the loudest in red ('redbars', R6); the looks choose their own form.
  // The heat logic decides how many bars take the accent (R4).
  music: 'none', redBy: 'heat', bandY: 'lowmid',

  // ── background ── Whisper: the paper tints very slightly with the intensity metric (R3–R4). No grain (R6).
  bg: 'whisper', drive: 'both', grain: 'off', night: 'off', top: 'none', scheme: 'graphite',

  // ── hits ── by parts, each hit on its own, driven by what the ride actually did (measured strength s and onset), never by a
  // rank (R7–R10). Each part answers s on its own curve with no ceiling (R15):
  //   shake: the thud, straight from 0 at s 0.2 to 24 px at 0.85, and on (R13, R15)            rsh 'lin'
  //   split: halfway between sideways and the hit's direction (R9), a slow start from 0.3 (x²) to the 24 px level (12.8 px of
  //          offset) at 0.85, and on (R15); over the whole picture, the band too (R11), with its zoom pulse (R18)
  //                                                                                            spl 'half', rsp 'ease30', spw 'all', pulse 'frame'
  //   flash: toward the paper, an S-curve from 0.6 to 25 % at 0.85, then gently on (R17)        fls 'paperRare', rfl 'r85'
  //   title: a little less split (R16) and less pulse (R19); the sun keeps everything (R18)     tsp '0.65', tpl '0.45'
  //   the rider keeps half its clean image through the split (R4, restored R12)
  hit: 'parts', drv: 'held', resp: 'r15', shk: 'thud', spl: 'half', fls: 'paperRare', spw: 'all',
  rsh: 'lin', rsp: 'ease30', rfl: 'r85', tsp: '0.65', tpl: '0.45', pulse: 'frame',

  // ── older hit controls ── used only with resp 'old' (R7–R14). Kept so earlier rounds' options still play in the lab.
  crv: 'lin', amp: '1.5', flg: 's55',
};
