# sh sheet.sh DIR SONG OUT names...   (crop y 300..1700, 33%)
d=$1; s=$2; o=$3; shift 3; args=()
for n in "$@"; do args+=( \( "$d/$n-$s.png" -crop 1080x1400+0+300 +repage -resize 33% -gravity north -background '#777' -splice 0x34 -pointsize 26 -fill white -annotate +0+3 "$n" \) ); done
magick "${args[@]}" +append "$o"
