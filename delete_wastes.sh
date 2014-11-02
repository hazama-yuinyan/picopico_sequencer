#!/bin/bash


DEST="$HOME/workspace/PicopicoSequencerGAE/picopico-seq/src/main/webapp"
DEST_PARENT="$HOME/workspace/PicopicoSequencerGAE/picopico-seq/src/main"
EXCLUDES="treehugger|dojox"

echo "Cleaning the intermmediate files..."
#find release -name "*.js.uncompressed.js" -delete
find release -name "*.js.consoleStripped.js" -delete
echo "Copying built files to DEST..."
# Move WEB-INF and favicon.ico to the parent directory of the destnation.
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

# Move back WEB-INF and favicon.ico to the destination directory.
mv "$DEST_PARENT/WEB-INF" "$DEST"
mv "$DEST_PARENT/favicon.ico" "$DEST"
