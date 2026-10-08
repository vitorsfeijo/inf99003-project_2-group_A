#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! -f "$1" || "$1" != *.osm.pbf ]]; then
  echo 'Uso: bash artefato/scripts/start-walking-osrm.sh /caminho/porto-alegre.osm.pbf' >&2
  exit 2
fi

data_dir="$(cd "$(dirname "$1")" && pwd)"
data_file="$(basename "$1")"
dataset="${data_file%.osm.pbf}.osrm"
image='ghcr.io/project-osrm/osrm-backend'

docker run --rm -v "$data_dir:/data" "$image" osrm-extract -p /opt/foot.lua "/data/$data_file"
docker run --rm -v "$data_dir:/data" "$image" osrm-partition "/data/$dataset"
docker run --rm -v "$data_dir:/data" "$image" osrm-customize "/data/$dataset"
docker run --rm -p 127.0.0.1:5000:5000 -v "$data_dir:/data" "$image" osrm-routed --algorithm mld "/data/$dataset"
