#!/bin/bash
# The last 4 s of a film running into its first 4 s: what a Short does when it replays.
cd /home/holo/prog/line-side-task/generated/concept-lab/films4
for c in paper hokusai waterline black; do
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 los-$c.mp4)
  ffmpeg -v error -y -ss $(python3 -c "print($d-4)") -i los-$c.mp4 -t 4 -i los-$c.mp4 -filter_complex "[0:v]trim=0:4,setpts=PTS-STARTPTS[a];[0:a]atrim=0:4,asetpts=PTS-STARTPTS[b];[1:v]trim=0:4,setpts=PTS-STARTPTS[c];[1:a]atrim=0:4,asetpts=PTS-STARTPTS[d];[a][b][c][d]concat=n=2:v=1:a=1[v][o]" -map '[v]' -map '[o]' -c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart seam-$c.mp4
done
