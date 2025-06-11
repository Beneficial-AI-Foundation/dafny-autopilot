import * as vscode from "vscode";
import * as path from "path";
import {
    callFillHints,
    callTranslatePython,
    callLangChain,
    explainDafnyAnnotation,
    verifyHighlightedDafny,
    claudePin,
    gptPin,
} from "./utils/helpers";

let disposables: vscode.Disposable[] | undefined;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("Dafny Autopilot");
    const config = vscode.workspace.getConfiguration("dafny-autopilot");
    context.subscriptions.push(outputChannel);
    const enableDevFeatures = process.env.DAFNY_AUTOPILOT_DEV === "true";
    config.update(
        "enableDevelopmentFeatures",
        enableDevFeatures,
        vscode.ConfigurationTarget.Workspace,
    );
    outputChannel.show(true);

    disposables = [
        vscode.commands.registerCommand(
            "dafny-autopilot.GPTFillHints",
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "This command must be invoked from a file context.",
                    );
                    return;
                }
                const filePath = uri.fsPath;
                const newFileName = `${path.parse(filePath).name}_with_hints${path.parse(filePath).ext}`;
                callFillHints(gptPin, filePath, newFileName);
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.ClaudeFillHints",
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "This command must be invoked from a file context.",
                    );
                    return;
                }
                const filePath = uri.fsPath;
                const newFileName = `${path.parse(filePath).name}_with_hints${path.parse(filePath).ext}`;
                callFillHints(claudePin, filePath, newFileName);
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.GeminiFillHints",
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "This command must be invoked from a file context.",
                    );
                    return;
                }
                const filePath = uri.fsPath;
                const newFileName = `${path.parse(filePath).name}_with_hints${path.parse(filePath).ext}`;
                callFillHints(
                    "gemini-2.5-pro-preview-06-05",
                    filePath,
                    newFileName,
                );
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.ClaudeLangchain",
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "This command must be invoked from a file context.",
                    );
                    return;
                }
                const filePath = uri.fsPath;
                callLangChain(claudePin, filePath, outputChannel);
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.GPTLangchain",
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "This command must be invoked from a file context.",
                    );
                    return;
                }
                const filePath = uri.fsPath;
                callLangChain(gptPin, filePath, outputChannel);
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.GeminiLangchain",
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "This command must be invoked from a file context.",
                    );
                    return;
                }
                const filePath = uri.fsPath;
                callLangChain(
                    "gemini-2.5-pro-preview-06-05",
                    filePath,
                    outputChannel,
                );
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.AWSLangchain",
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "This command must be invoked from a file context.",
                    );
                    return;
                }
                const filePath = uri.fsPath;
                callLangChain(
                    "anthropic.claude-sonnet-4-20250514-v1:0",
                    filePath,
                    outputChannel,
                );
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.GPTTranslatePython",
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "This command must be invoked from a Python file context.",
                    );
                    return;
                }
                const filePath = uri.fsPath;
                callTranslatePython(gptPin, filePath);
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.ClaudeTranslatePython",
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(
                        "This command must be invoked from a Python file context.",
                    );
                    return;
                }
                const filePath = uri.fsPath;
                callTranslatePython(claudePin, filePath);
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.explainDafnyAnnotationGPT",
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage("No active editor.");
                    return;
                }
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                if (!selectedText) {
                    vscode.window.showErrorMessage("No text selected.");
                    return;
                }
                explainDafnyAnnotation(gptPin, selectedText, outputChannel);
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.explainDafnyAnnotationClaude",
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage("No active editor.");
                    return;
                }
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                if (!selectedText) {
                    vscode.window.showErrorMessage("No text selected.");
                    return;
                }
                explainDafnyAnnotation(claudePin, selectedText, outputChannel);
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.explainDafnyAnnotationAWSBedrock",
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage("No active editor.");
                    return;
                }
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                if (!selectedText) {
                    vscode.window.showErrorMessage("No text selected.");
                    return;
                }
                explainDafnyAnnotation(
                    "anthropic.claude-sonnet-4-20250514-v1:0",
                    selectedText,
                    outputChannel,
                );
            },
        ),

        vscode.commands.registerCommand(
            "dafny-autopilot.toggleDevFeatures",
            () => {
                const currentValue = config.get("enableDevelopmentFeatures");
                config.update(
                    "enableDevelopmentFeatures",
                    !currentValue,
                    vscode.ConfigurationTarget.Workspace,
                );
                vscode.window.showInformationMessage(
                    `Development features ${!currentValue ? "enabled" : "disabled"}`,
                );
                outputChannel.appendLine(
                    `Development features toggled to: ${!currentValue}`,
                );
            },
        ),
        vscode.commands.registerCommand(
            "dafny-autopilot.verifyHighlightedDafny",
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage("No active editor.");
                    return;
                }
                const selection = editor.selection;
                const selectedText = editor.document.getText(selection);
                if (!selectedText) {
                    vscode.window.showErrorMessage("No text selected.");
                    return;
                }
                const filePath = editor.document.uri.fsPath;
                verifyHighlightedDafny(
                    claudePin,
                    selectedText,
                    filePath,
                    outputChannel,
                );
            },
        ),
    ];
    context.subscriptions.push(...disposables);
    outputChannel.appendLine("Dafny Autopilot extension activated");
}

export function deactivate() {
    if (disposables) {
        disposables.forEach((d) => d.dispose());
        disposables = [];
    }
}
