#!/bin/bash

ROOTDIR=$(cd $(dirname $0) && pwd)

SRCDIR="$ROOTDIR/src"

TOOLSDIR="$SRCDIR/lib/util/buildscripts"

RESOURCES=(src/manual_style.css src/help_ja.html src/help_en.html)

CMD="./build.sh --profile $SRCDIR/app/picopico_sequencer.profile.js --require $SRCDIR/app/run.js --dojoConfig $SRCDIR/app/config_build.js $EXTRA_FLAGS"

if [ ! -d "$TOOLSDIR" ]; then
    echo "Can't find Dojo build tools -- did you initialize submodules?(git submodule update --init --recursive)"
    exit 1
fi

if [ $1 = "--no-build" ]; then
    EXTRA_FLAGS="--check-args"
    cd $TOOLSDIR
    $CMD $EXTRA_FLAGS
    exit 0
fi

echo Cleaning old built files...
rm -rf release
cd $TOOLSDIR

$CMD

echo "Copying html and css files..."
cd $ROOTDIR

cat src/index.html | tr '\n' ' ' | \
perl -pe "
  s/<\!--.*?-->//g;     #Strip comments
  s/<script src=\"app\/config.js\"><\/script>//g;
  s/\"lib\/dojo\/dojo.js\"/\"dojo\/dojo.js\"/;
  s/\s+/ /; #Collapse white-spaces" > release/index.html
for path in ${RESOURCES[@]} ; do
    cp $path release
done
echo "Build complete!"