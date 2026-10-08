@echo off
REM Lance un petit serveur web local et ouvre le tableau de bord D3.js
REM (un navigateur ne peut pas lire base.csv depuis une page ouverte en file://)
cd /d "%~dp0"
echo Tableau de bord : http://localhost:8000/visualisations/
echo Laissez cette fenetre ouverte ; fermez-la pour arreter le serveur.
start "" "http://localhost:8000/visualisations/"
python -m http.server 8000
pause
