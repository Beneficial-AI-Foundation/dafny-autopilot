import * as vscode from 'vscode';
import * as path from 'path';
import { exec, ExecException } from 'child_process';

interface DafnyResult {
    stdout: string;
    stderr: string;
    error?: string;
}

export async function ensureDafnyPath(): Promise<string | undefined> {
    let dafnyPath = vscode.workspace.getConfiguration().get<string>('dafny-autopilot.dafnyPath');
    if (!dafnyPath) {
        dafnyPath = await askDafnyPath();
    }
    return dafnyPath;
}

export async function askDafnyPath(): Promise<string> {
    const dafnyPath = await vscode.window.showInputBox({
        prompt: 'Please enter the path to the Dafny executable.',
        ignoreFocusOut: true,
        placeHolder: 'Enter the path to the Dafny executable',
    });

    if (!dafnyPath) {
        throw new Error('Path to Dafny executable is required to use the extension.');
    }

    await vscode.workspace.getConfiguration().update(
        'dafny-autopilot.dafnyPath',
        dafnyPath,
        vscode.ConfigurationTarget.Global
    );
    
    return dafnyPath;
}

export function runDafny(filePath: string, newFilePath: string, dafnyPath: string): Promise<DafnyResult> {
    const pythonPath = vscode.workspace.getConfiguration().get('python.defaultInterpreterPath');
    const pythonVersion = pythonPath === 'python3' ? pythonPath : 'python3';
    const scriptPath = path.join(__dirname, '../src/utils', 'run_dafny.py');

    return new Promise((resolve) => {
        exec(
            `${pythonVersion} "${scriptPath}" "${filePath}" "${newFilePath}" "${dafnyPath}"`,
            { maxBuffer: 1024 * 1024 * 10 }, // Increase buffer to handle larger outputs
            (error: ExecException | null, stdout: string, stderr: string) => {
                // Always resolve with the output, even if there's an error
                const result: DafnyResult = {
                    stdout: processOutput(stdout),
                    stderr: processOutput(stderr),
                    error: error?.message
                };

                // If there's an error, show it in VS Code but still resolve
                if (error) {
                    vscode.window.showErrorMessage('Error running Dafny: ' + error.message);
                    
                    // If stderr is empty but stdout contains error messages, move them to stderr
                    if (!result.stderr && result.stdout.includes('Error:')) {
                        result.stderr = result.stdout;
                        result.stdout = '';
                    }
                }

                resolve(result);
            }
        );
    });
}

function processOutput(output: string): string {
    if (!output) { return ''; }
    
    // Convert Buffer to string if needed
    const str = Buffer.isBuffer(output) ? output.toString('utf-8') : output;
    
    return str
        .replace(/^b['"]|['"]$/g, '')  // Remove Python byte string markers
        .replace(/\\n/g, '\n')         // Replace escaped newlines
        .replace(/\\'/g, "'")          // Replace escaped single quotes
        .replace(/\\"/g, '"')          // Replace escaped double quotes
        .replace(/\r\n/g, '\n')        // Normalize line endings
        .trim();
}