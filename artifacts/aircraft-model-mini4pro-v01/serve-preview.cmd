@echo off
cd /d "%~dp0"
echo DJI Mini 4 Pro preview: http://localhost:17839/
py -3 -m http.server 17839 --bind 127.0.0.1 --directory "%~dp0"
