#!/bin/bash
# Placeholder coin skins, tinted from the classic coin, until the real art arrives.
# Writes public/assets/images/coins/<skin>-sheriff.webp, -outlaw.webp and -icon.webp
# for every skin whose file is missing; a file already there (real art) is kept.
# Needs ImageMagick 7 (`magick`). Usage: scripts/coin-placeholders.sh [--force]
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../public/assets/images/coins" && pwd)"
FORCE="${1:-}"

# writes $1 with the rest of the arguments unless it exists
make() {
  local out="$DIR/$1"
  shift
  if [[ -e "$out" && "$FORCE" != "--force" ]]; then return; fi
  magick "$@" -quality 82 "$out"
  echo "wrote $out"
}

for face in sheriff outlaw; do
  src="$DIR/classic-$face.webp"
  # silver: desaturated and cool
  make "silver-$face.webp" "$src" -modulate 118,6,100 -fill '#c4d2e4' -colorize 14%
  # gold: warmer and richer
  make "gold-$face.webp" "$src" -modulate 108,165,104
  # rusty: darker, brown, with a grainy surface, keeping the round outline
  make "rusty-$face.webp" "$src" -modulate 78,75,95 \
    \( -size 640x640 xc:gray50 -seed 7 -attenuate 1.4 +noise Gaussian -blur 0x2.2 \
    -colorspace Gray -level 30%,70% \) -compose Overlay -composite \
    \( "$src" -alpha extract \) -compose CopyOpacity -composite \
    -fill '#5a2a0c' -tint 40
  # bullet-holed: three dark holes with a bright torn edge
  make "holed-$face.webp" "$src" \
    -fill 'rgba(40,20,8,0.85)' -draw 'circle 210,430 238,430' \
    -draw 'circle 440,200 464,200' -draw 'circle 470,470 490,470' \
    -fill 'rgba(5,2,0,1)' -draw 'circle 210,430 228,430' \
    -draw 'circle 440,200 456,200' -draw 'circle 470,470 483,470' \
    -fill none -stroke 'rgba(255,220,170,0.55)' -strokewidth 3 \
    -draw 'circle 210,430 240,430' -draw 'circle 440,200 466,200' -draw 'circle 470,470 492,470'
done

# icons: the sheriff face, small
for skin in classic silver gold rusty holed; do
  make "$skin-icon.webp" "$DIR/$skin-sheriff.webp" -resize 128x128
done
