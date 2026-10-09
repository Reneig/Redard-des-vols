@echo off
REM Lance un petit serveur web local et ouvre le tableau de bord D3.js
REM (un navigateur ne peut pas lire la base depuis une page ouverte en file://)
cd /d "%~dp0"
echo Tableau de bord : http://localhost:8000/visualisations/synthese.html
echo Laissez cette fenetre ouverte ; fermez-la pour arreter le serveur.
REM ouvre le navigateur 2 secondes plus tard, le temps que le serveur demarre
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8000/visualisations/synthese.html"
python -m http.server 8000
pause