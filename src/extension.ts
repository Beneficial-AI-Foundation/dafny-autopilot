import * as vscode from 'vscode';
import * as path from 'path';
import { callFillHints, callTranslatePython, callLangChain, explainDafnyAnnotation } from './utils/helpers';

let disposables: vscode.Disposable[] | undefined;
let outputChannel: vscode.OutputChannel;


export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("Dafny Autopilot");
    const config = vscode.workspace.getConfiguration('dafny-autopilot');
    context.subscriptions.push(outputChannel);
    const enableDevFeatures = process.env.DAFNY_AUTOPILOT_DEV === 'true';
    config.update('enableDevelopmentFeatures', enableDevFeatures, vscode.ConfigurationTarget.Workspace);
    outputChannel.show(true);

    disposables = [
        vscode.commands.registerCommand('dafny-autopilot.GPTFillHints', async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('This command must be invoked from a file context.');
                return;
            }
            const filePath = uri.fsPath;
            const newFileName = `${path.parse(filePath).name}_with_hints${path.parse(filePath).ext}`;
            callFillHints('gpt-4o', filePath, newFileName);
        }),

        vscode.commands.registerCommand('dafny-autopilot.ClaudeFillHints', async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('This command must be invoked from a file context.');
                return;
            }
            const filePath = uri.fsPath;
            const newFileName = `${path.parse(filePath).name}_with_hints${path.parse(filePath).ext}`;
            callFillHints('claude-3-5-sonnet-latest', filePath, newFileName);
        }),

        vscode.commands.registerCommand('dafny-autopilot.GeminiFillHints', async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('This command must be invoked from a file context.');
                return;
            }
            const filePath = uri.fsPath;
            const newFileName = `${path.parse(filePath).name}_with_hints${path.parse(filePath).ext}`;
            callFillHints('gemini-1.5-pro', filePath, newFileName);
        }),

        vscode.commands.registerCommand('dafny-autopilot.ClaudeLangchain', async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('This command must be invoked from a file context.');
                return;
            }
            const filePath = uri.fsPath;
            callLangChain('claude-3-5-sonnet-latest', filePath, outputChannel);
        }),

        vscode.commands.registerCommand('dafny-autopilot.GPTLangchain', async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('This command must be invoked from a file context.');
                return;
            }
            const filePath = uri.fsPath;
            callLangChain('gpt-4o', filePath, outputChannel);
        }),

        vscode.commands.registerCommand('dafny-autopilot.GeminiLangchain', async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('This command must be invoked from a file context.');
                return;
            }
            const filePath = uri.fsPath;
            callLangChain('gemini-1.5-pro', filePath, outputChannel);
        }),

        vscode.commands.registerCommand('dafny-autopilot.AWSLangchain', async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('This command must be invoked from a file context.');
                return;
            }
            const filePath = uri.fsPath;
            callLangChain('anthropic.claude-3-5-sonnet-20241022-v2:0', filePath, outputChannel);
        }),

        vscode.commands.registerCommand('dafny-autopilot.GPTTranslatePython', async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('This command must be invoked from a Python file context.');
                return;
            }
            const filePath = uri.fsPath;
            callTranslatePython('gpt-4o', filePath);
        }),

        vscode.commands.registerCommand('dafny-autopilot.ClaudeTranslatePython', async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('This command must be invoked from a Python file context.');
                return;
            }
            const filePath = uri.fsPath;
            callTranslatePython('claude-3-5-sonnet-latest', filePath);
        }),
        
        vscode.commands.registerCommand('dafny-autopilot.explainDafnyAnnotationGPT', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor.');
                return;
            }
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            if (!selectedText) {
                vscode.window.showErrorMessage('No text selected.');
                return;
            }
            explainDafnyAnnotation('gpt-4o', selectedText, outputChannel);
        }),

        vscode.commands.registerCommand('dafny-autopilot.explainDafnyAnnotationClaude', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor.');
                return;
            }
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            if (!selectedText) {
                vscode.window.showErrorMessage('No text selected.');
                return;
            }
            explainDafnyAnnotation('claude-3-5-sonnet-latest', selectedText, outputChannel);
        }),

        vscode.commands.registerCommand('dafny-autopilot.explainDafnyAnnotationAWSBedrock', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor.');
                return;
            }
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            if (!selectedText) {
                vscode.window.showErrorMessage('No text selected.');
                return;
            }
            explainDafnyAnnotation('anthropic.claude-3-5-sonnet-20241022-v2:0', selectedText, outputChannel);
        }),

        vscode.commands.registerCommand('dafny-autopilot.toggleDevFeatures', () => {
            const currentValue = config.get('enableDevelopmentFeatures');
            config.update('enableDevelopmentFeatures', !currentValue, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`Development features ${!currentValue ? 'enabled' : 'disabled'}`);
            outputChannel.appendLine(`Development features toggled to: ${!currentValue}`);
        })
    ];
    context.subscriptions.push(...disposables);
    outputChannel.appendLine("Dafny Autopilot extension activated");
}


export function deactivate() {
    if (disposables) {
        disposables.forEach(d => d.dispose());
        disposables = [];
    }
}
