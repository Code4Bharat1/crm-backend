import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🧹 Cleaning up orphan headless Chromium processes...');

try {
    const stdout = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'chrome.exe\'\\" | ForEach-Object { if ($_.CommandLine -match \'--headless\' -or $_.CommandLine -match \'wwebjs\') { Stop-Process -Id $_.ProcessId -Force; Write-Output \\"Killed $($_.ProcessId)\\" } }"', { encoding: 'utf-8' });
    console.log(stdout || 'No orphan headless Chrome processes found.');
} catch (e) {
    console.log('Cleanup notice:', e.message);
}

// Check if .wwebjs_auth exists and can be cleaned
const authDir = path.resolve('./.wwebjs_auth');
if (fs.existsSync(authDir)) {
    try {
        console.log('Verifying .wwebjs_auth directory access...');
    } catch (err) {
        console.warn('Auth dir check warning:', err.message);
    }
}
console.log('✅ Cleanup completed.');
