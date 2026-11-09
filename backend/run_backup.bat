@echo off
cd /d C:\Users\raghu\OneDrive\Documents\GST_Client_Management_System\backend
if not exist ..\backups mkdir ..\backups
python backup.py >> ..\backups\backup_log.txt 2>&1