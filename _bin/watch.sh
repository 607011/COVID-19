#!/usr/local/bin/bash

watchify js/corona.js  -o 'uglify --js js/corona.js > static/corona.min.js' -v &
