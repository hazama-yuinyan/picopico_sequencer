#!/bin/bash


DEST="$HOME/workspace/PicopicoSequencer/war"

echo "Cleaning the intermmediate files..."
find release -name "*.js.*" -delete
echo "Copying built files to DEST..."
mv release/build-report.txt .
cp -Rvu release/* $DEST