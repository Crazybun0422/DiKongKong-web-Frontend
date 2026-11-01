@echo off
cd /d "%~dp0"
echo DJI Inspire 3 preview: http://localhost:17840/
py -3 -m http.server 17840 --bind 127.0.0.1 --directory "%~dp0"
