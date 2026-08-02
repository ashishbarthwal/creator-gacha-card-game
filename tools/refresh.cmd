@echo off
REM tools\refresh.cmd — what Windows Task Scheduler actually invokes.
REM
REM WHY A WRAPPER AND NOT `npm run deploy` DIRECTLY. A scheduled task gets no
REM console and no working directory: it runs from C:\Windows\System32 with
REM output going nowhere. Every one of those matters here — `npm run deploy`
REM must run at the repo root to find the key and the candidate DB, and an
REM unattended deploy that fails silently is worse than one that never ran,
REM because the site keeps serving a snapshot that is quietly ageing past the
REM 30-day cap on stored statistics.
REM
REM So this does three things the scheduler will not: cd to the repo, append
REM everything to a log with a timestamp, and record the exit code.
REM
REM The chain it runs (package.json):
REM   build-set   re-hydrates every candidate id  (~400 quota units, no searches)
REM   build-site  assembles _site, runs the four guards
REM   netlify     direct upload to production
REM   record-deploy  writes the `deploy` line of the refresh ledger
REM
REM Register it with:  node tools/schedule-refresh.js

cd /d "%~dp0.."
if not exist "reports" mkdir "reports"

set "LOG=reports\refresh.log"

echo. >> "%LOG%"
echo ==================================================================== >> "%LOG%"
echo [%date% %time%] refresh starting >> "%LOG%"

call npm run deploy >> "%LOG%" 2>&1
set "CODE=%ERRORLEVEL%"

echo [%date% %time%] finished with exit code %CODE% >> "%LOG%"

REM The ledger and the refreshed pool hints are COMMITTED files that this run
REM modifies, and nothing here commits them — an unattended job that writes to
REM git history is a job that rewrites the receipts nobody watched it produce.
REM They are left dirty on purpose, so the next `git status` shows the refresh
REM happened and asks to be committed.
if "%CODE%"=="0" (
  echo [%date% %time%] NOTE: catalog/refresh-log.json and catalog/candidates.json are now modified — commit them. >> "%LOG%"
) else (
  echo [%date% %time%] FAILED — the site is still serving the previous snapshot. Run  node tools/status.js  to see how much time is left. >> "%LOG%"
)

exit /b %CODE%
