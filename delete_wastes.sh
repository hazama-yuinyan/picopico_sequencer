#!/bin/bash


DEST="$HOME/workspace/PicopicoSequencer/war"
DEST_PARENT="$HOME/workspace/PicopicoSequencer"
EXCLUDES="treehugger|dojox"

echo "Cleaning the intermmediate files..."
find release -name "*.js.*" -delete
echo "Copying built files to DEST..."
mv "$DEST/WEB-INF" "$DEST_PARENT"
mv "$DEST/favicon.ico" "$DEST_PARENT"
mv release/build-report.txt .
rm -R $DEST/*

echo "Copying neccessary files..."
SOURCES=(`ls release`)
for path in ${SOURCES[@]} ; do
    TMP=`echo $path | grep -E $EXCLUDES -`
    if [ -z "$TMP" ] ; then
	cp -Rvu "release/$path" "$DEST"
    fi
done

mkdir "$DEST/dojox"
cp -Ruv "release/dojox/gfx" "$DEST/dojox"

mv "$DEST_PARENT/WEB-INF" "$DEST"
mv "$DEST_PARENT/favicon.ico" "$DEST"