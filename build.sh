#!/bin/bash

echo Deleting old built files...
rm -rf release
cd src/lib/util/buildscripts
./build.sh --profile ~/workspace/picopico_sequencer/src/app/picopico_sequencer.profile.js --require ~/workspace/picopico_sequencer/src/app/run.js --dojoConfig ~/workspace/picopico_sequencer/src/app/config_build.js
echo Coping html and css files...
cd ../../..
for path in ["src/index.html", "src/manual_style.css", "src/style.css", "help_en.html", "src/help_ja.html"] ;do
    cp $path release
done
echo Done!