#!/bin/bash


DEST="$HOME/workspace/PicopicoSequencer/war"
DEST_PARENT="$HOME/workspace/PicopicoSequencer"

echo "Cleaning the intermmediate files..."
find release -name "*.js.*" -delete
echo "Copying built files to DEST..."
mv $DEST/WEB-INF $DEST_PARENT
mv $DEST/favicon.ico $DEST_PARENT
mv release/build-report.txt .
rm -R $DEST/*
cp -Rvu release/* $DEST
mv $DEST_PARENT/WEB-INF $DEST
mv $DEST_PARENT/favicon.ico $DEST