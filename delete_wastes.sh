#!/bin/bash


DEST="$HOME/workspace/PicopicoSequencer/war"

find release -name "*.js.*" -delete
echo "Copying built files to DEST..."
cp -Rvu release/* $DEST