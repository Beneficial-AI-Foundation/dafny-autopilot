import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';


export async function ensureDafnyPath(): Promise<string | undefined> {
    let dafnyPath = vscode.workspace.getConfiguration().get<string>('dafny-autopilot.dafnyPath');
    if (!dafnyPath) {
        dafnyPath = await askDafnyPath();
    }
    return dafnyPath;
}


export async function askDafnyPath(): Promise<string> {
    let dafnyPath = await vscode.window.showInputBox({
        prompt: 'Please enter the path to the Dafny executable.',
        ignoreFocusOut: true,
        placeHolder: 'Enter the path to the Dafny executable',
    });

    if (dafnyPath) {
        await vscode.workspace.getConfiguration().update('dafny-autopilot.dafnyPath', dafnyPath, vscode.ConfigurationTarget.Global);
        return dafnyPath;
    } else {
        throw new Error('Path to Dafny executable is required to use the extension.');
    }
}


export function runDafny(filePath: string, newFilePath: string, dafnyPath: string): Promise<{ stdout: string, stderr: string }> {
    const pythonPath = vscode.workspace.getConfiguration().get('python.defaultInterpreterPath');
    const pythonVersion = pythonPath === 'python3' ? pythonPath : 'python3';
    const scriptPath = path.join(__dirname, '../src/utils', 'run_dafny.py');

    return new Promise((resolve) => {
        exec(`${pythonVersion} "${scriptPath}" "${filePath}" "${newFilePath}" "${dafnyPath}"`, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage('Error running Dafny: ' + error.message);
                return;
            }
            
            // Decode the stdout and stderr
            const decodedStdout = Buffer.from(stdout, 'utf-8').toString('utf-8');
            const decodedStderr = Buffer.from(stderr, 'utf-8').toString('utf-8');
            
            resolve({ 
                stdout: decodedStdout.replace(/^b['"]|['"]$/g, '').replace(/\\n/g, '\n'),
                stderr: decodedStderr.replace(/^b['"]|['"]$/g, '').replace(/\\n/g, '\n')
            });
        });
    });
}
