#!/bin/bash
# Two 9:16 videos side by side on a dark ground, rounded, labelled THEN and NOW (ground.png, mask.png), with the new one's sound.
#   generated/concept-lab/then-and-now/join.sh OLD.mp4 NEW.mp4 OUT.mp4 [SECONDS_TO_DROP_FROM_OLD] [LENGTH_S]
# The old Tiki video's sound starts 79 ms after the song's, so five of its frames go (0.0833).
set -e; here=$(dirname "$0"); skip=${4:-0.0833}; length=${5:-48}
ffmpeg -v error -y -loop 1 -framerate 60 -i "$here/ground.png" -ss "$skip" -i "$1" -i "$2" -loop 1 -framerate 60 -i "$here/mask.png" -filter_complex \
 "[3:v]format=gray,split[m1][m2];[1:v]scale=504:896:flags=lanczos,format=rgba[o];[o][m1]alphamerge[ol];[2:v]scale=504:896:flags=lanczos,format=rgba[n];[n][m2]alphamerge[nw];[0:v][ol]overlay=408:64[a];[a][nw]overlay=1008:64,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv[v]" \
 -map "[v]" -map 2:a -c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:a copy -t "$length" -movflags +faststart "$3"
