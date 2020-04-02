#!/bin/sh

DIST=dist
SERVER=cx20
REMOTE_DIR=/var/www/ersatzworld.net/html/corona

tar -C ${DIST} -czf - . | ssh ${SERVER} "(tar -C ${REMOTE_DIR} -xzf - )"