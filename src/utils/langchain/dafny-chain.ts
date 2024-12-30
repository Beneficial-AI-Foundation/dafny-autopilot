import * as fs from 'fs';
import * as vscode from 'vscode';
import { PRECONDITION_PROMPT, POSTCONDITION_PROMPT, INVARIANT_PROMPT, FIX_PROMPT, FIX_SYNTAX_PROMPT } from '../prompts';

import { runDafny, ensureDafnyPath } from '../dafny-helpers';


export class DafnyChain {
    private llm: any;
    private preconditionTemplate: any;
    private postconditionTemplate: any;
    private invariantTemplate: any;
    private fixSyntaxTemplate: any;
    private fixTemplate: any;
    private preconditionChain: any;
    private invariantChain: any;
    private fixSyntaxChain: any;
    private fixChain: any;
    private postconditionChain: any;
    private outputParser: any;

    constructor(private modelName: string = 'gpt-4', private outputChannel: vscode.OutputChannel) {}
    private log(message: string) {
        this.outputChannel.appendLine(message);
    }
    private async initializeDependencies() {
        const { PromptTemplate } = await import('@langchain/core/prompts');
        const { RunnableSequence } = await import('@langchain/core/runnables');
        const { StringOutputParser } = await import('@langchain/core/output_parsers');

        if (this.modelName.startsWith('gpt')) {
            const { ChatOpenAI } = await import('@langchain/openai');
            this.llm = new ChatOpenAI({ modelName: this.modelName, temperature: 0.0 });
        } else if (this.modelName.startsWith('claude')) {
            const { ChatAnthropic } = await import('@langchain/anthropic');
            this.llm = new ChatAnthropic({ 
                modelName: this.modelName, 
                temperature: 0.1,
                maxTokens: 8192,
                clientOptions: {
                    defaultHeaders: {
                        "anthropic-beta": "max-tokens-3-5-sonnet-2024-07-15"
                    }
                }
             });
        } else if (this.modelName.startsWith('gemini')) {
            const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
            this.llm = new ChatGoogleGenerativeAI({
                modelName: this.modelName,
                maxOutputTokens: 8192,
            });
        } else if (this.modelName.startsWith('anthropic.')) {
            const { ChatBedrockConverse } = await import('@langchain/aws');
            const { readFile } = await import('fs/promises');
            const { join } = await import('path');
            const { homedir } = await import('os');
            const { parse } = await import('ini');
        
            
            // let region = await vscode.window.showQuickPick(['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-northeast-1'], {
            //     placeHolder: 'Select AWS Region',
            //     ignoreFocusOut: true
            // });
            let region = await this.promptForAWSRegion();
            
            
        
            const accessKeyId = process.env.BEDROCK_AWS_ACCESS_KEY_ID;
            const secretAccessKey = process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;
            if (!accessKeyId || !secretAccessKey) {
                throw new Error('AWS credentials not found in environment variables.');
            }
        
            this.llm = new ChatBedrockConverse({ 
                model: this.modelName,
                credentials: {
                    accessKeyId,
                    secretAccessKey
                },
                temperature: 0.1,
                maxTokens: 4096,
                region
            });
        } else {
            throw new Error(`Unsupported model: ${this.modelName}`);
        }

        this.outputParser = new StringOutputParser();
        this.preconditionTemplate = PromptTemplate.fromTemplate(PRECONDITION_PROMPT);
        this.postconditionTemplate = PromptTemplate.fromTemplate(POSTCONDITION_PROMPT);
        this.invariantTemplate = PromptTemplate.fromTemplate(INVARIANT_PROMPT);
        this.fixSyntaxTemplate = PromptTemplate.fromTemplate(FIX_SYNTAX_PROMPT);
        this.fixTemplate = PromptTemplate.fromTemplate(FIX_PROMPT);

        this.preconditionChain = RunnableSequence.from([this.preconditionTemplate, this.llm, this.outputParser]);
        this.invariantChain = RunnableSequence.from([this.invariantTemplate, this.llm, this.outputParser]);
        this.fixSyntaxChain = RunnableSequence.from([this.fixSyntaxTemplate, this.llm, this.outputParser]);
        this.fixChain = RunnableSequence.from([this.fixTemplate, this.llm, this.outputParser]);
        this.postconditionChain = RunnableSequence.from([this.postconditionTemplate, this.llm, this.outputParser]);
    }

    private async promptForAWSRegion(): Promise<string> {
        const regions = [
            { label: 'us-east-1', description: 'US East (N. Virginia)' },
            { label: 'us-east-2', description: 'US East (Ohio)' },
            { label: 'us-west-1', description: 'US West (N. California)' },
            { label: 'us-west-2', description: 'US West (Oregon)' },
            { label: 'eu-west-1', description: 'Europe (Ireland)' },
            { label: 'eu-west-2', description: 'Europe (London)' },
            { label: 'eu-central-1', description: 'Europe (Frankfurt)' },
            { label: 'ap-northeast-1', description: 'Asia Pacific (Tokyo)' },
            { label: 'ap-southeast-1', description: 'Asia Pacific (Singapore)' },
            { label: 'ap-southeast-2', description: 'Asia Pacific (Sydney)' }
        ];
    
        const region = await vscode.window.showQuickPick(regions, {
            placeHolder: 'Select AWS Region',
            ignoreFocusOut: true
        });
    
        if (!region) {
            throw new Error('AWS Region is required for Bedrock.');
        }
        return region.label;
    }

    private readDafnyFile(filePath: string): string {
        if (!fs.existsSync(filePath)) {
            vscode.window.showErrorMessage(`The file ${filePath} does not exist.`);
            throw new Error(`The file ${filePath} does not exist.`);
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (!content) {
                vscode.window.showErrorMessage(`File ${filePath} is empty.`);
                throw new Error(`The file ${filePath} is empty.`);
            }
            return content;
        } catch (e) {
            vscode.window.showErrorMessage(`Error reading file: ${filePath}`);
            throw e;
        }
    }

    private writeDafnyFile(filePath: string, content: string): void {
        fs.writeFileSync(filePath, content);
    }

    private parseDafnyOutput(output: string, filePath: string): [string[], string[], string[]] {
        const cleanedOutput = this.cleanDafnyOutput(output);

        const lines = cleanedOutput.split('\n');
        const errors: string[] = [];
        const warnings: string[] = [];
        const otherIssues: string[] = [];

        let currentIssue: string | null = null;
        let currentIssueType: 'error' | 'warning' | 'other' | null = null;

        for (const line of lines.map(l => l.trim())) {
            if (line.includes("Error:") || (line.match(/\(\d+,\d+\):/) && !currentIssueType)) {
                if (currentIssue) {
                    (currentIssueType === 'error' ? errors :
                     currentIssueType === 'warning' ? warnings :
                     otherIssues).push(this.cleanDafnyOutput(currentIssue));
                }
                currentIssue = line;
                currentIssueType = 'error';
            } else if (line.includes("Warning:")) {
                if (currentIssue) {
                    (currentIssueType === 'error' ? errors :
                     currentIssueType === 'warning' ? warnings :
                     otherIssues).push(this.cleanDafnyOutput(currentIssue));
                }
                currentIssue = line;
                currentIssueType = 'warning';
            } else if (line.includes("Dafny program verifier finished with") && line.includes("0 errors")) {
                if (currentIssue) {
                    (currentIssueType === 'error' ? errors :
                     currentIssueType === 'warning' ? warnings :
                     otherIssues).push(this.cleanDafnyOutput(currentIssue));
                }
                otherIssues.push(line);
                currentIssue = null;
                currentIssueType = null;
            } else if (line && currentIssue) {
                currentIssue += '\n' + line;
            }
        }

        // Add the last issue if there is one
        if (currentIssue) {
            (currentIssueType === 'error' ? errors :
             currentIssueType === 'warning' ? warnings :
             otherIssues).push(this.cleanDafnyOutput(currentIssue));
        }

        return [errors, warnings, otherIssues];
    }

    private stripCodeDelimiters(code: string): string {
        let modifiedCode = code.trim();
        if (modifiedCode.startsWith('```dafny')) {
            modifiedCode = modifiedCode.slice(8);
        }
        if (modifiedCode.endsWith('```')) {
            modifiedCode = modifiedCode.slice(0, -3);
        }
        return modifiedCode.trim();
    }

    async processDafnyFile(filePath: string): Promise<[string]> {
        try {
            await this.initializeDependencies();

            const newFilePath = await this.prepareModifiedFile(filePath);
            const maxIterations = vscode.workspace.getConfiguration('dafny-autopilot').get<number>('numIterations', 2);

            for (let iteration = 0; iteration < maxIterations; iteration++) {
                if (await this.runVerificationIteration(filePath, newFilePath, iteration, maxIterations)) {
                    return [newFilePath];
                }
            }

            this.logFailure(maxIterations);
            return [newFilePath];
        } catch (error) {
            this.logError(error);
            throw error;
        }
    }


    async processHighlightedDafny(model: string, selectedText: string, filePath: string, outputChannel: vscode.OutputChannel): Promise<string> {
        try {
            const dafnyChain = new DafnyChain(model, outputChannel);
            vscode.window.showInformationMessage('Verifying highlighted Dafny function...');
            
            const newFilePath = filePath.replace('.dfy', '_modified.dfy');
            let modifiedCode = await dafnyChain.applyChains(selectedText);
            
            // Write the modified code to the new file
            await vscode.workspace.fs.writeFile(vscode.Uri.file(newFilePath), Buffer.from(modifiedCode));
            
            // Run Dafny verification
            const dafnyPath = await ensureDafnyPath();
            if (dafnyPath) {
                const { stdout, stderr } = await runDafny(filePath, newFilePath, dafnyPath);
                outputChannel.appendLine('\nDafny verification result:');
                outputChannel.appendLine(stdout);
                if (stderr) {
                    outputChannel.appendLine('Errors:');
                    outputChannel.appendLine(stderr);
                }

                if (stderr) {
                    vscode.window.showWarningMessage('Dafny verification completed with warnings / errors. Check the output channel for details.');
                } else {
                    vscode.window.showInformationMessage('Dafny verification completed successfully.');
                }
            }

            return newFilePath;
        } catch (error) {
            vscode.window.showErrorMessage('Error verifying Dafny function.');
            console.error(error);
            throw error;
        }
    }

    private async prepareModifiedFile(filePath: string): Promise<string> {
        let code = this.readDafnyFile(filePath);
        this.log(`Reading Dafny code from file: ${filePath}`);

        let modifiedCode = await this.applyChains(code);
        const newFilePath = filePath.replace('.dfy', '_modified.dfy');
        this.log(`Writing modified code to file: ${newFilePath}`);
        this.writeDafnyFile(newFilePath, modifiedCode);

        return newFilePath;
    }

    private async applyChains(code: string): Promise<string> {
        let modifiedCode = await this.preconditionChain.invoke({ code: code });
        this.log(`Precondition chain output:\n${modifiedCode}\n`);
        modifiedCode = this.extractDafnyCode(modifiedCode);
    
        modifiedCode = await this.invariantChain.invoke({ code: modifiedCode });
        this.log(`Invariant chain output:\n${modifiedCode}\n`);
        modifiedCode = this.extractDafnyCode(modifiedCode);
    
        modifiedCode = await this.postconditionChain.invoke({ code: modifiedCode });
        this.log(`Postcondition chain output:\n${modifiedCode}\n`);
        return this.extractDafnyCode(modifiedCode);
    }

    private async runVerificationIteration(filePath: string, newFilePath: string, iteration: number, maxIterations: number): Promise<boolean> {
        this.logIterationStart(iteration, maxIterations);

        const dafnyPath = this.getDafnyPath();
        const dafnyOutput = await this.runDafnyVerification(filePath, newFilePath, dafnyPath);
        const [errors, warnings, otherIssues] = this.parseDafnyOutput(dafnyOutput, newFilePath);
        this.logVerificationResult(errors, warnings, otherIssues);

        if (this.isVerificationSuccessful(errors, warnings, otherIssues)) {
            this.logSuccess(iteration);
            return true;
        }
        if (iteration < maxIterations - 1) {
            await this.attemptFix(newFilePath, errors, warnings, otherIssues);
        }
        return false;
    }

    private getDafnyPath(): string {
        const dafnyPath: string | undefined = vscode.workspace.getConfiguration('dafny-autopilot').get('dafnyPath');
        if (!dafnyPath) {
            throw new Error('Dafny path is not set in the configuration.');
        }
        return dafnyPath;
    }

    private async runDafnyVerification(filePath: string, newFilePath: string, dafnyPath: string): Promise<string> {
        let { stdout, stderr } = await runDafny(filePath, newFilePath, dafnyPath);
        let output = this.cleanDafnyOutput(stdout + stderr);
        this.log(`Dafny verification output:\n${output}\n`);
        return output;
    }

    private extractDafnyCode(output: string): string {
        const codeBlockRegex = /```dafny\n([\s\S]*?)```/i;
        const match = output.match(codeBlockRegex);
        if (match && match[1]) {
            return match[1].trim();
        }
        // If no code block is found, return the entire output
        return output.trim();
    }

    private cleanDafnyOutput(output: string): string {
        // Remove any 'b' prefix and quotes
        output = output.replace(/^b?['"]|['"]$/g, '');
    
        // Unescape common escape sequences
        let cleanedOutput = output
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    
        // Remove file paths
        cleanedOutput = cleanedOutput.replace(/Users(?:\w:)?(?:\/|\\)(?:[\w\.-]+(?:\/|\\))*[\w\.-]+\.dfy/g, '');

        // Trim any leading or trailing whitespace
        return cleanedOutput.trim();
    }

    private isVerificationSuccessful(errors: string[], warnings: string[], otherIssues: string[]): boolean {
        return errors.length === 0;
    }

    private async attemptFix(filePath: string, errors: string[], warnings: string[], otherIssues: string[]): Promise<void> {
        const allIssues = [...errors, ...warnings, ...otherIssues];
        
        this.log("\nAttempting to fix issues:");
        allIssues.slice(0, 2).forEach((issue, index) => {
            this.log(`Issue ${index + 1}:\n${this.cleanDafnyOutput(issue)}\n`);
        });
        
        const issues = allIssues.join('\n\n');
        let modifiedCode = await this.readDafnyFile(filePath);
        
        const fixResult = await this.fixChain.invoke({ modified_code: modifiedCode, issue: issues });
        let fixedCode = this.extractDafnyCode(fixResult);
        this.log(`Fix chain output:\n${fixedCode}\n`);
            
        this.writeDafnyFile(filePath, fixedCode);
        this.log("\nFixed code written to file: " + filePath);
    }

    private logIterationStart(iteration: number, maxIterations: number): void {
        this.log(`\nStarting iteration ${iteration + 1} of ${maxIterations}:`);
        vscode.window.showInformationMessage(`Starting iteration ${iteration + 1} of ${maxIterations}`);
    }

    private logVerificationResult(errors: string[], warnings: string[], otherIssues: string[]): void {
        this.log(`Errors: ${errors.length}, Warnings: ${warnings.length}, Other output lines: ${otherIssues.length}`);
    }

    private logSuccess(iteration: number): void {
        const successMessage = `Verification successful after ${iteration + 1} iteration(s)`;
        this.log(successMessage);
        vscode.window.showInformationMessage(successMessage);
    }

    private logFailure(maxIterations: number): void {
        const failureMessage = `Failed to fix all issues after ${maxIterations} iterations`;
        vscode.window.showErrorMessage(failureMessage);
    }

    private logError(error: unknown): void {
        this.log('Error in processDafnyFile: ' + (error instanceof Error ? error.message : String(error)));
        if (error instanceof Error && error.stack) {
            this.log('Error stack: ' + error.stack);
        }
    }
}
