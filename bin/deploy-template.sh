#!/bin/sh

DIST=dist
SERVER="change to your server's host name"
REMOTE_DIR="change to destination path on server"

tar -C ${DIST} -czf - . | ssh ${SERVER} "(tar -C ${REMOTE_DIR} -xzf - )"
