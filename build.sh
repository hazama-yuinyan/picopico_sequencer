#!/bin/bash

ROOTDIR=$(cd $(dirname $0) && pwd)

SRCDIR="$ROOTDIR/src"

TOOLSDIR="$SRCDIR/lib/util/buildscripts"

RESOURCES=(src/style.css src/manual_style.css src/help_ja.html src/help_en.html)

if [ ! -d "$TOOLSDIR" ]; then
    echo "Can't find Dojo build tools -- did you initialize submodules?(git submodule update --init --recursive)"
    exit 1
fi

echo Cleaning old built files...
rm -rf release
cd $TOOLSDIR
./build.sh --profile $SRCDIR/app/picopico_sequencer.profile.js --require $SRCDIR/app/run.js --dojoConfig $SRCDIR/app/config_build.js

echo "Copying html and css files..."
cd $ROOTDIR

cat src/index.html | tr '\n' ' ' | \
perl -pe "
  s/<\!--.*?-->//g;     #Strip comments
  s/<script src=\"app\/config.js\"><\/script>//g;
  s/\"lib\/dojo\/dojo.js\"/\"dojo\/dojo.js\"/;
  s/\"lib\/dijit\/themes\/claro\/claro.css\"/\"dijit\/themes\/claro\/claro.css\"/;
  s/\s+/ /; #Collapse white-spaces" > release/index.html
for path in ${RESOURCES[@]} ; do
    cp $path release
done
echo "Build complete!"