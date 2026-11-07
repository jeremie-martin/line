import numpy as np,sys,glob
from PIL import Image

class ni:
    @staticmethod
    def binary_erosion(m,iterations=1):
        for _ in range(iterations):
            m=m&np.roll(m,1,0)&np.roll(m,-1,0)&np.roll(m,1,1)&np.roll(m,-1,1)
        return m
S=sys.argv[1]  # folder holding enc/ from clip.mjs
PAL={'graphite':dict(paper='#ffffff',ink='#15181d',pencil='#b4bcc8',mass='#3b414a',accent='#d3262e',np='#14171d',ni='#eef1f5'),
'klein':dict(paper='#ffffff',ink='#0d1433',pencil='#b4bcd8',mass='#0f2fb5',accent='#f2500f',np='#0a1a6e',ni='#f5f7ff'),
'hokusai':dict(paper='#f4ecdc',ink='#12294d',pencil='#b8b4a4',mass='#1d3e73',accent='#d4412a',np='#0d1f3f',ni='#f4ecdc'),
'bottle':dict(paper='#f3f1e4',ink='#0e2e27',pencil='#b0b9a8',mass='#14604c',accent='#c96805',np='#0a2a23',ni='#f6efcf'),
'salmon':dict(paper='#fce6d9',ink='#3a1024',pencil='#cfb3a8',mass='#7a1438',accent='#007a78',np='#2b0a1a',ni='#fce6d9'),
'blueprint':dict(paper='#123f7f',ink='#f3f7ff',pencil='#4c70aa',mass='#dfe9fb',accent='#ffb300',np='#071d40',ni='#f3f7ff')}
rgb=lambda h:np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
def lin(c):
    c=np.asarray(c,float)/255;return np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
def Y(h): return float((lin(rgb(h))*[.2126,.7152,.0722]).sum())
def cr(a,b):
    x,y=sorted((Y(a),Y(b)),reverse=True);return (x+.05)/(y+.05)
M=np.array([[.4124,.3576,.1805],[.2126,.7152,.0722],[.0193,.1192,.9505]])
def lab(c):
    xyz=lin(c)@M.T/np.array([.9505,1,1.089]);f=np.where(xyz>.008856,np.cbrt(xyz),7.787*xyz+16/116)
    return np.stack([116*f[...,1]-16,500*(f[...,0]-f[...,1]),200*(f[...,1]-f[...,2])],-1)
de=lambda a,b:float(np.linalg.norm(lab(rgb(a))-lab(rgb(b))))
scarf=['#fd4f38','#3995fd','#06a725']
print('pal       ink/pap penc/pap mass/pap acc/pap acc/mass | n: ink/pap pen/pap acc/pap | scarf/pap R B G | dE acc~scarfR')
for k,p in PAL.items():
    npen='#%02x%02x%02x'%tuple((rgb(p['np'])+(rgb(p['ni'])-rgb(p['np']))*.38).astype(int))
    print(k.ljust(9),*['%.1f'%cr(p[a],p[b]) for a,b in [('ink','paper'),('pencil','paper'),('mass','paper'),('accent','paper'),('accent','mass')]],'|','%.1f %.1f %.1f'%(cr(p['ni'],p['np']),cr(npen,p['np']),cr(p['accent'],p['np'])),'|',*['%.1f'%cr(s,p['paper']) for s in scarf],'| %.0f'%de(p['accent'],'#fd4f38'))
print()
for k,p in PAL.items():
  for form in ['fork','bars']:
    r=[];
    for K in (40,80,110):
        s=np.array(Image.open(f'{S}/enc/{k}-{form}-{K}-src.png').convert('RGB'),float);d=np.array(Image.open(f'{S}/enc/{k}-{form}-{K}-dec.png').convert('RGB'),float)
        c=rgb(p['accent']); c=c if form=='fork' else (c*.92+rgb(p['paper'])*.08); m=(np.abs(s-c).sum(2)<8)
        if m.sum()<30: continue
        core=ni.binary_erosion(m,iterations=2) if form=='bars' else ni.binary_erosion(m,iterations=1)
        ls=lab(c);ld=lab(d[core]);C0=np.hypot(ls[1],ls[2]);Cd=np.hypot(ld[:,1],ld[:,2]);dE=np.linalg.norm(ld-ls,axis=1)
        # edge: full mask
        la=lab(d[m]);Ca=np.hypot(la[:,1],la[:,2])
        r.append((np.median(Cd)/C0,np.median(Ca)/C0,np.median(dE),np.percentile(dE,90),m.sum()))
    # thin pencil / stems chroma? mass
    if r:
        r=np.array(r).mean(0);print(k.ljust(9),form,'chroma core %.0f%% whole-shape %.0f%% dE med %.1f p90 %.1f px %d'%(100*r[0],100*r[1],r[2],r[3],r[4]))

import subprocess
print()
print('strips: accent on paper, chroma kept at centre, width px 2 3 4 6 10 18; 4:2:0 only / x264 crf34, then rail-thin ink 3.6px')
W=[2,3,4,6,10,18]
for k,p in PAL.items():
    im=np.zeros((720,720,3),np.uint8)+rgb(p['paper']).astype(np.uint8)
    pos=[]
    x=41
    for w in W:
        im[40:680,x:x+w]=rgb(p['accent']).astype(np.uint8);pos.append((x,w));x+=w+60
    Image.fromarray(im).save(f'{S}/enc/st-{k}.png')
    out={}
    for name,args in (('420',['-c:v','libx264','-qp','0','-pix_fmt','yuv420p']),('crf34',['-c:v','libx264','-crf','34','-pix_fmt','yuv420p'])):
        subprocess.run(['ffmpeg','-v','error','-y','-loop','1','-t','0.5','-framerate','30','-i',f'{S}/enc/st-{k}.png','-vf','scale=out_color_matrix=bt709:out_range=tv,format=yuv420p','-colorspace','bt709','-color_range','tv',*args,f'{S}/enc/st.mp4'],check=True)
        subprocess.run(['ffmpeg','-v','error','-y','-i',f'{S}/enc/st.mp4','-vf','select=eq(n\\,10),scale=in_color_matrix=bt709:in_range=tv,format=rgb24','-frames:v','1',f'{S}/enc/st-dec.png'],check=True)
        d=np.array(Image.open(f'{S}/enc/st-dec.png').convert('RGB'),float)
        ls=lab(rgb(p['accent']));C0=np.hypot(ls[1],ls[2]);row=[]
        lp=lab(rgb(p['paper']));
        for x,w in pos:
            col=d[100:620,x:x+w].reshape(-1,3);lc=lab(col);row.append(np.median(np.hypot(lc[:,1]-lp[1]*0,lc[:,2]-lp[2]*0))/C0)
        out[name]=row
    print(k.ljust(9),'420  ',' '.join('%3.0f'%(100*v) for v in out['420']),'| crf34',' '.join('%3.0f'%(100*v) for v in out['crf34']))
