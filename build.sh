#!/bin/bash

ROOTDIR=$(cd $(dirname $0) && pwd)

SRCDIR="$ROOTDIR/src"

TOOLSDIR="$SRCDIR/lib/util/buildscripts"

RESOURCES=(src/manual_style.css src/help_ja.html src/help_en.html src/about_en.html src/about_ja.html src/public_imgs)

ABOUT_FILES=($SRCDIR/about_en.html $SRCDIR/about_ja.html)

PACKAGE_FILE="$SRCDIR/app/package.json"

CMD="./build.sh --profile $SRCDIR/app/picopico_sequencer.profile.js --require $SRCDIR/app/run.js --dojoConfig $SRCDIR/app/config_build.js $EXTRA_FLAGS"

if [ ! -d "$TOOLSDIR" ]; then
    echo "Can't find Dojo build tools -- did you initialize submodules?(git submodule update --init --recursive)"
    exit 1
fi

if [ $# -gt 1 -a $1 = "--no-build" ]; then
    EXTRA_FLAGS="--check-args"
    cd $TOOLSDIR
    $CMD $EXTRA_FLAGS
    exit 0
fi

if [ $# -gt 1 -a $1 = "--rewrite-version" ]; then
    if [ $# -lt 2 ]; then
	echo "No new version number found. Please enter some version-ish number!"
	exit 1
    fi
    for file in ${ABOUT_FILES[@]} ; do
	sed -e "s/version:[.0-9]\+$/version:$2/" $file > $SRCDIR/tmp.html
	diff $SRCDIR/tmp.html $file
	rm -i $file
	mv $SRCDIR/tmp.html $file
    done
    sed -e "s/\"version\" : \"[.0-9]\+\"/\"version\" : \"$2\"/" $PACKAGE_FILE > $SRCDIR/app/tmp.json
    diff $SRCDIR/app/tmp.json $PACKAGE_FILE
    rm -i $PACKAGE_FILE
    mv $SRCDIR/app/tmp.json $PACKAGE_FILE
    exit 0
fi

echo "Cleaning old built files..."
rm -rf release
cd $TOOLSDIR

$CMD

echo "Copying html and css files..."
cd $ROOTDIR

cat src/index.html | tr '\n' ' ' | \
perl -pe "
  s/<\!--.*?-->//g;     #Strip comments
  s/<script src=\"app\/config.js\"><\/script>/<script>dojoConfig = {async:true,baseUrl:'',tlmSiblingOfDojo:false,parseOnLoad:false,packages:[\"dojo\",\"dijit\",\"dojox\",\"treehugger\",\"app\",\"piano_roll\"]};<\/script>/g;
  s/\"lib\/dojo\/dojo.js\"/\"dojo\/dojo.js\"/;
  s/\s+/ /; #Collapse white-spaces" > "release/index.html"
for path in ${RESOURCES[@]} ; do
    cp -R $path release
done
echo "Build completed!"