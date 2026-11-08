"""generated/concept-lab/theme-variants.py · Variants of theme drafts: as drafted, matched to the nearest Sanzo Wada combination, and tuned by the rules learned from the
owner's verdicts (generated/concept-lab/agents/wada/NOTES.md). Usage: python3 variants.py OUT.json DRAFTS.json...
Each DRAFTS file: {"schemes": {...}, "drops": {...}, "themes": {id: {name, line, look}}} (palettes.js / look.js format)."""
import json, math, sys, itertools

WADA = json.load(open('/home/holo/prog/line-side-task/generated/concept-lab/agents/wada/src/colors.json'))
COMBOS = {}
for c in WADA:
    for n in c['combinations']: COMBOS.setdefault(n, []).append(c)

def srgb(h): return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
def lin(v): return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
def delin(v): return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
def oklab(h):
    r, g, b = map(lin, srgb(h))
    l, m, s = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b, 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    l, m, s = (x ** (1 / 3) for x in (l, m, s))
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)
def hexof(L, a, b):
    l, m, s = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    return '#' + ''.join(f'{round(max(0, min(1, delin(max(0, v)))) * 255):02x}' for v in rgb)
def lch(h): L, a, b = oklab(h); return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360
def fromlch(L, C, H): return hexof(L, C * math.cos(math.radians(H)), C * math.sin(math.radians(H)))
def de(h1, h2): return math.dist(oklab(h1), oklab(h2))
def setL(h, L): _, C, H = lch(h); return fromlch(L, C, H)
def setC(h, C): L, _, H = lch(h); return fromlch(L, C, H)
def mix(h1, h2, t): a, b = oklab(h1), oklab(h2); return hexof(*[x + (y - x) * t for x, y in zip(a, b)])

def luminance(h): return sum(w * lin(v) for w, v in zip((0.2126, 0.7152, 0.0722), srgb(h)))
def contrast(h1, h2): a, b = sorted((luminance(h1), luminance(h2)), reverse=True); return (a + 0.05) / (b + 0.05)

def quiet_paper(p):
    """The paper quietened as the owner's verdicts require: a light paper barely tinted, a dark one a room, not a void."""
    L, C, H = lch(p)
    if L >= 0.8: return fromlch(L, min(C, 0.03 if 40 <= H <= 95 else 0.02), H)
    if L <= 0.32: return fromlch(L, min(max(C, 0.012), 0.04), H)
    return p

def legible(s):
    """The learned steps: bars more colourful than the paper, bar/paper lightness step in range, accent apart from the bars,
    ink far from the paper, the pencil between them."""
    s = dict(s); s['paper'] = quiet_paper(s['paper'])
    Lp, Cp, _ = lch(s['paper']); light = Lp >= 0.5
    lo, hi = (0.38, 0.6) if light else (0.32, 0.62)
    Lm, Cm, Hm = lch(s['mass'])
    step = abs(Lm - Lp)
    if step < lo or step > hi: Lm = Lp - (lo + hi) / 2 if light else Lp + (lo + hi) / 2
    s['mass'] = fromlch(max(0.08, min(0.95, Lm)), max(Cm, Cp + 0.04), Hm)
    La, Ca, Ha = lch(s['accent']); Lm = lch(s['mass'])[0]
    if abs(La - Lm) < 0.12: La = Lm + 0.14 if Lm < 0.8 else Lm - 0.14
    s['accent'] = fromlch(max(0.1, min(0.97, La)), Ca, Ha)
    # a deliberate ink (a red line) or pencil (a blue pencil) is kept while it reads: ink 4.5:1 against the paper, the pencil
    # visible (1.25:1) but quieter than the ink
    if contrast(s['ink'], s['paper']) < 4.5: s['ink'] = mix(s['mass'], '#101010' if light else '#fafafa', 0.85)
    if not 1.25 <= contrast(s['pencil'], s['paper']) <= min(3.5, contrast(s['ink'], s['paper'])): s['pencil'] = mix(s['paper'], s['ink'], 0.3)
    if 'sun' in s:
        Ls, Cs, Hs = lch(s['sun'])
        if abs(Ls - Lp) < 0.15: s['sun'] = fromlch(Lp - 0.25 if light else Lp + 0.3, Cs, Hs)
    return s

def wada(s):
    """The Wada combination nearest the draft's paper, bars and accent (and a distinct sun), every role assignment tried."""
    roles = ['paper', 'mass', 'accent'] + (['sun'] if s.get('sun') and de(s['sun'], s['accent']) > 0.05 else [])
    weights = {'paper': 1.5, 'mass': 1.2, 'accent': 1.0, 'sun': 0.8}
    best = None
    for n, cols in COMBOS.items():
        if len(cols) < len(roles): continue
        for pick in itertools.permutations(cols, len(roles)):
            cost = sum(weights[r] * de(s[r], c['hex']) for r, c in zip(roles, pick))
            if best is None or cost < best[0]: best = (cost, n, pick)
    cost, n, pick = best
    m = dict(s)
    for r, c in zip(roles, pick): m[r] = c['hex']
    if 'sun' in s and 'sun' not in roles: m['sun'] = m['accent']
    return legible(m), {'combination': n, 'colours': {r: c['name'] for r, c in zip(roles, pick)}, 'distance': round(cost, 3)}

out = {'schemes': {}, 'drops': {}, 'themes': {}}
for path in sys.argv[2:]:
    d = json.load(open(path))
    for tid, t in d['themes'].items():
        sid = t['look']['scheme']; base = d['schemes'][sid]; partner = d.get('drops', {}).get(sid)
        variants = {'asis': (base, None), 'wada': wada(base), 'tuned': (legible(base), None)}
        for v, (scheme, note) in variants.items():
            name = f'{tid}_{v}'; out['schemes'][name] = scheme
            if partner:
                p = d['schemes'][partner]
                out['schemes'][name + 'Drop'] = p if v == 'asis' else (wada(p)[0] if v == 'wada' else legible(p))
                out['drops'][name] = name + 'Drop'
            out['themes'][name] = {'draft': tid, 'variant': v, 'name': t['name'], 'line': t['line'], 'look': {**t['look'], 'scheme': name}, **({'wada': note} if note else {})}
json.dump(out, open(sys.argv[1], 'w'), indent=1)
print(len(out['themes']), 'variants;', sum(1 for t in out['themes'].values() if t['variant'] == 'wada'), 'matched to Wada')
for t in out['themes'].values():
    if t['variant'] == 'wada': print(f"  {t['name']}: no. {t['wada']['combination']} {t['wada']['colours']} (distance {t['wada']['distance']})")
