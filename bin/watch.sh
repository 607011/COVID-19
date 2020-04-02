#!/usr/local/bin/bash

watchify js/corona.js  -o 'minify --js js/corona.js > static/corona.min.js' -v &
watchify js/corona.js  -o 'uglifycss css/default.css > static/corona.min.css' -v &
