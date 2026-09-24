#!/bin/sh
# Construit TableauSage.exe (Windows 10/11, 64 bits) dans ../dist.
set -e
cd "$(dirname "$0")"
VERSION="${VERSION:-1.0.0}"

go run github.com/tc-hib/go-winres@v0.3.3 simply \
  --arch amd64 --manifest cli --icon winres/icon.png \
  --product-name "Tableau Sage" --file-description "Tableau de bord Sage 100 (lecture seule)" \
  --product-version "$VERSION" --file-version "$VERSION" --original-filename TableauSage.exe

mkdir -p ../dist
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath \
  -ldflags "-s -w -X main.version=$VERSION" -o ../dist/TableauSage.exe .
rm -f rsrc_windows_amd64.syso
ls -l ../dist/TableauSage.exe
