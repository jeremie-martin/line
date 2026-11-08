#!/bin/bash
# grid12.sh SONG OUT T1..T12: twelve films in a 6x2 4K grid (562x1000 panels), names under each panel (fourup/frame12.png); kept
# in the video standard (scripts/video/encoding.ts: BT.709, all tags).
cd /home/holo/prog/line-side-task/generated/concept-lab
s=$1; out=$2; shift 2; d=${DIR:-films7}
in=(); for t in "$@"; do in+=(-i "$d/$s-$t.mp4"); done
mapfile -t P < fourup/grid12.txt
f="color=c=0xd9dbde:s=3840x2160:r=60,format=yuv420p[bg];"
for i in $(seq 0 11); do f+="[$i:v]scale=562:1000:flags=lanczos[v$i];"; done
prev=bg; for i in $(seq 0 11); do set -- ${P[$i]}; nxt=x$i; [ $i = 0 ] && sh=":shortest=1" || sh=""; f+="[$prev][v$i]overlay=$1:$2$sh[$nxt];"; prev=$nxt; done
f+="[12:v]format=rgba,scale=out_color_matrix=bt709:out_range=tv,format=yuva420p[t];[$prev][t]overlay=0:0:shortest=1,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv[v]"
ffmpeg -v error -y "${in[@]}" -loop 1 -framerate 60 -i fourup/frame12.png -filter_complex "$f" -map '[v]' -map 0:a -c:v libx264 -crf 18 -preset slow -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 256k -movflags +faststart "$out"
