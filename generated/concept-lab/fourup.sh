#!/bin/bash
# fourup.sh SONG OUT LOOK1 LOOK2 LOOK3 LOOK4: four films side by side, 4K, 60 fps, no text; kept in the video standard
# (scripts/video/encoding.ts: BT.709, all tags).
cd /home/holo/prog/line-side-task/generated/concept-lab
s=$1; out=$2; f=${DIR:-films5}/$s; shift 2
ffmpeg -v error -y -i $f-$1.mp4 -i $f-$2.mp4 -i $f-$3.mp4 -i $f-$4.mp4 -loop 1 -framerate 60 -i fourup/frame.png -filter_complex "
color=c=0x808080:s=3840x2160:r=60,format=yuv420p[bg];
[0:v]scale=900:1600:flags=lanczos[a];[1:v]scale=900:1600:flags=lanczos[b];[2:v]scale=900:1600:flags=lanczos[c];[3:v]scale=900:1600:flags=lanczos[d];
[bg][a]overlay=48:280:shortest=1[x1];[x1][b]overlay=996:280[x2];[x2][c]overlay=1944:280[x3];[x3][d]overlay=2892:280[x4];
[4:v]format=rgba,scale=out_color_matrix=bt709:out_range=tv,format=yuva420p[t];[x4][t]overlay=0:0:shortest=1,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv[v]" -map '[v]' -map 0:a -c:v libx264 -crf 17 -preset slow -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a aac -b:a 256k -movflags +faststart $out
