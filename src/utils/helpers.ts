import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as process from 'process';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ChatBedrockConverse } from '@langchain/aws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as prompts from './prompts';
import { DafnyChain } from './langchain/dafny-chain';
import { runDafny, askDafnyPath, ensureDafnyPath } from './dafny-helpers';


export async function callFillHints(model: string, filePath: string, newFileName: string) {
    if (!model.startsWith('gpt') && !model.startsWith('claude')) {
        vscode.window.showErrorMessage('Invalid model name.');
        return;
    }

    const newFilePath = path.join(path.dirname(filePath), newFileName);

    try {
        const data = await fs.readFile(filePath, 'utf8');
        const dafnyPath = await ensureDafnyPath();

        let apiKey: string | undefined;
        if (model.startsWith('gpt')) {
            apiKey = await ensureGPTApiKey();
        } else if (model.startsWith('claude')) {
            apiKey = await ensureClaudeApiKey();
        }

        if (apiKey && dafnyPath) {
            let LLMOutput: string | null | undefined;
            if (model.startsWith('gpt')) {
                LLMOutput = await GPTFillHints(apiKey, data);
            } else if (model.startsWith('claude')) {
                LLMOutput = await ClaudeFillHints(apiKey, data);
            } else if (model.startsWith('gemini')) {
                LLMOutput = await GeminiFillHints(apiKey, data);
            }
            if (typeof LLMOutput === 'string') {
                await fs.writeFile(newFilePath, LLMOutput);
                await openDiffView(filePath, newFilePath);
                runDafny(filePath, newFilePath, dafnyPath);
            }
        } else {
            vscode.window.showErrorMessage('OpenAI API key & Dafny path are required to use the extension.');
        }
    } catch (err) {
        vscode.window.showErrorMessage(`Error processing file: ${err}`);
        console.error(err);
    }
}


async function GPTFillHints(GPTApiKey: string | undefined, fileContent: string) {
	if (!GPTApiKey) {
		vscode.window.showErrorMessage('API key is required to use the extension.');
		return;
	}

	const openai = new OpenAI({apiKey: GPTApiKey});
    vscode.window.showInformationMessage('Generating Dafny hints from the file content...');
	const sysPrompt = prompts.SYS_DAFNY;
	const userPrompt = prompts.GEN_HINTS_FROM_BODY + "\n\n" + fileContent;

	try {
		const response = await openai.chat.completions.create({
			model: 'gpt-4o',
			messages: [
				{"role": "system", "content": sysPrompt},
				{"role": "user", "content": userPrompt}
			],
		});
		return response.choices[0].message.content;
	} catch (error) {
		vscode.window.showErrorMessage('Error connecting to OpenAI API.');
		console.error(error);
	}
}


async function ClaudeFillHints(ClaudeApiKey: string | undefined, fileContent: string) {
	if (!ClaudeApiKey) {
		vscode.window.showErrorMessage('API key is required to use the extension.');
		return;
	}

    const anthropic = new Anthropic({apiKey: ClaudeApiKey});
    vscode.window.showInformationMessage('Generating Dafny hints from the file content...');
    const sysPrompt = prompts.SYS_DAFNY;
    const userPrompt = prompts.GEN_HINTS_FROM_BODY + "\n\n" + fileContent;

    try {
        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 4096,
            system: sysPrompt,
            messages: [
                {"role": "user", "content": userPrompt}
            ]
            });
        return (response.content[0] as Anthropic.TextBlock).text;
    } catch (error) {
        vscode.window.showErrorMessage('Error connecting to Anthropic API.');
        console.error(error);
    }
}


async function GeminiFillHints(GeminiApiKey: string | undefined, fileContent: string) {
    if (!GeminiApiKey) {
        vscode.window.showErrorMessage('API key is required to use the extension.');
        return;
    }

    const genAI = new GoogleGenerativeAI(GeminiApiKey);
    vscode.window.showInformationMessage('Generating Dafny hints from the file content...');
    const sysPrompt = prompts.SYS_DAFNY;
    const userPrompt = prompts.GEN_HINTS_FROM_BODY + "\n\n" + fileContent;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    try {
        const result = await model.generateContent([sysPrompt, userPrompt]);
        return result.response.text();
    } catch (error) {
        vscode.window.showErrorMessage('Error connecting to Anthropic API.');
        console.error(error);
    }
}


export async function callTranslatePython(model: string, filePath: string) {
    if (!model.startsWith('gpt') && !model.startsWith('claude')) {
        vscode.window.showErrorMessage('Invalid model name.');
        return;
    }

    try {
        const pythonCode = await fs.readFile(filePath, 'utf8');
        const dafnyPath = await ensureDafnyPath();

        let apiKey: string | undefined;
        if (model.startsWith('gpt')) {
            apiKey = await ensureGPTApiKey();
        } else if (model.startsWith('claude')) {
            apiKey = await ensureClaudeApiKey();
        }

        if (apiKey && dafnyPath) {
            let translatedCode: string | null | undefined;
            if (model.startsWith('gpt')) {
                translatedCode = await GPTTranslatePython(apiKey, pythonCode);
            } else if (model.startsWith('claude')) {
                translatedCode = await ClaudeTranslatePython(apiKey, pythonCode);
            }
            if (typeof translatedCode === 'string') {
                const dafnyFilePath = filePath.replace(/\.py$/, '_translated.dfy');
                await fs.writeFile(dafnyFilePath, translatedCode);
                await vscode.window.showTextDocument(vscode.Uri.file(dafnyFilePath));
                runDafny(filePath, dafnyFilePath, dafnyPath);
            }
        }
    } catch (err) {
        vscode.window.showErrorMessage('Error reading the Python file.');
        console.error(err);
    }
}


async function GPTTranslatePython(GPTApiKey: string, pythonCode: string): Promise<string | undefined> {
    const openai = new OpenAI({apiKey: GPTApiKey});
    vscode.window.showInformationMessage('Translating Python code to Dafny & verifying...');
    const sysPrompt = prompts.COMPILER_PROMPT;
    const userPrompt = prompts.GEN_DAFNY_FROM_PYTHON + "\n\n" + pythonCode;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {"role": "user", "content": userPrompt},
                {"role": "system", "content": sysPrompt}
            ],
        });

        let content = response.choices[0]?.message.content || '';  // Process the response to remove specified substrings
        content = content.replace(/^```dafny/, '');  // Remove '```dafny' prefix
        content = content.replace(/```$/, '');  // Remove '```' suffix
        return content || undefined;
    } catch (error) {
        vscode.window.showErrorMessage('Error connecting to OpenAI API.');
        console.error(error);
        return undefined;  // Return undefined if there is an error during the API call
    }
}


async function ClaudeTranslatePython(ClaudeApiKey: string, pythonCode: string): Promise<string | undefined> {
    const anthropic = new Anthropic({apiKey: ClaudeApiKey});
    vscode.window.showInformationMessage('Translating Python code to Dafny & verifying...');
    const sysPrompt = prompts.COMPILER_PROMPT;
    const userPrompt = prompts.GEN_DAFNY_FROM_PYTHON + "\n\n" + pythonCode;

    try {
        const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20240620",
            max_tokens: 4096,
            system: sysPrompt,
            messages: [
                {"role": "user", "content": userPrompt}
            ]
        });

        let content = (response.content[0] as Anthropic.TextBlock).text || '';  // Process the response to remove specified substrings
        content = content.replace(/^```dafny/, '');  // Remove '```dafny' prefix
        content = content.replace(/```$/, '');  // Remove '```' suffix
        return content || undefined;
    } catch (error) {
        vscode.window.showErrorMessage('Error connecting to Anthropic API.');
        console.error(error);
        return undefined;  // Return undefined if there is an error during the API call
    }
}

export async function ensureGPTApiKey(): Promise<string | undefined> {
    let apiKey = vscode.workspace.getConfiguration().get<string>('openai.apiKey');
    if (!apiKey) {
        apiKey = await askGPTApiKey();
    }
    return apiKey;
}


export async function askGPTApiKey(): Promise<string> {
    let apiKey = await vscode.window.showInputBox({
        prompt: 'Please enter your OpenAI API key.',
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'Enter your OpenAI API key',
    });

    if (apiKey) {
        await vscode.workspace.getConfiguration().update('openai.apiKey', apiKey, vscode.ConfigurationTarget.Global);
        return apiKey;
    } else {
        throw new Error('API key is required to use the extension.');
    }
}


export async function ensureClaudeApiKey(): Promise<string | undefined> {
    let apiKey = vscode.workspace.getConfiguration().get<string>('anthropic.apiKey');
    if (!apiKey) {
        apiKey = await askClaudeApiKey();
    }
    return apiKey;
}


export async function askClaudeApiKey(): Promise<string> {
    let apiKey = await vscode.window.showInputBox({
        prompt: 'Please enter your Anthropic API key.',
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'Enter your Anthropic API key',
    });

    if (apiKey) {
        await vscode.workspace.getConfiguration().update('anthropic.apiKey', apiKey, vscode.ConfigurationTarget.Global);
        return apiKey;
    } else {
        throw new Error('API key is required to use the extension.');
    }
}


export async function ensureGeminiApiKey(): Promise<string | undefined> {
    let apiKey = vscode.workspace.getConfiguration().get<string>('google.apiKey');
    if (!apiKey) {
        apiKey = await askGeminiApiKey();
    }
    return apiKey;
}


export async function askGeminiApiKey(): Promise<string> {
    let apiKey = await vscode.window.showInputBox({
        prompt: 'Please enter your Google API key.',
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'Enter your Google API key',
    });

    if (apiKey) {
        await vscode.workspace.getConfiguration().update('google.apiKey', apiKey, vscode.ConfigurationTarget.Global);
        return apiKey;
    } else {
        throw new Error('API key is required to use the extension.');
    }
}

// Ensure AWS Access Key ID
export async function ensureAWSAccessKeyId(): Promise<string | undefined> {
    let accessKeyId = vscode.workspace.getConfiguration().get<string>('aws.accessKeyId');
    if (!accessKeyId) {
        accessKeyId = await askAWSAccessKeyId();
    }
    return accessKeyId;
}

// Ask for AWS Access Key ID
export async function askAWSAccessKeyId(): Promise<string> {
    let accessKeyId = await vscode.window.showInputBox({
        prompt: 'Please enter your AWS Access Key ID.',
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'Enter your AWS Access Key ID',
    });

    if (accessKeyId) {
        await vscode.workspace.getConfiguration().update('aws.accessKeyId', accessKeyId, vscode.ConfigurationTarget.Global);
        return accessKeyId;
    } else {
        throw new Error('AWS Access Key ID is required to use the extension.');
    }
}

// Ensure AWS Secret Access Key
export async function ensureAWSSecretAccessKey(): Promise<string | undefined> {
    let secretAccessKey = vscode.workspace.getConfiguration().get<string>('aws.secretAccessKey');
    if (!secretAccessKey) {
        secretAccessKey = await askAWSSecretAccessKey();
    }
    return secretAccessKey;
}

// Ask for AWS Secret Access Key
export async function askAWSSecretAccessKey(): Promise<string> {
    let secretAccessKey = await vscode.window.showInputBox({
        prompt: 'Please enter your AWS Secret Access Key.',
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'Enter your AWS Secret Access Key',
    });

    if (secretAccessKey) {
        await vscode.workspace.getConfiguration().update('aws.secretAccessKey', secretAccessKey, vscode.ConfigurationTarget.Global);
        return secretAccessKey;
    } else {
        throw new Error('AWS Secret Access Key is required to use the extension.');
    }
}

// Ensure both AWS credentials are set
export async function ensureAWSCredentials(): Promise<{ accessKeyId: string; secretAccessKey: string }> {
    let accessKeyId = await ensureAWSAccessKeyId();
    let secretAccessKey = await ensureAWSSecretAccessKey();

    while (!accessKeyId || !secretAccessKey) {
        if (!accessKeyId) {
            vscode.window.showWarningMessage('AWS Access Key ID is missing. Please enter it.');
            accessKeyId = await askAWSAccessKeyId();
        }
        if (!secretAccessKey) {
            vscode.window.showWarningMessage('AWS Secret Access Key is missing. Please enter it.');
            secretAccessKey = await askAWSSecretAccessKey();
        }
    }

    return { accessKeyId, secretAccessKey };
}


export async function ensureNumIterations(): Promise<number | undefined> {
    let numIterations = vscode.workspace.getConfiguration('dafny-autopilot').get<number>('numIterations');
    if (!(numIterations && Number.isInteger(numIterations) && numIterations > 0)) {
        numIterations = await askNumIterations();
    }
    return numIterations;
}


export async function askNumIterations(): Promise<number> {
    let numIterationsString = await vscode.window.showInputBox({
        prompt: 'Please enter your desired maximum number of iterations performed by LLM.',
        ignoreFocusOut: true,
        password: false,
        placeHolder: 'Enter your desired max # of iterations performed by LLM (a positive int)',
    });
    if (!numIterationsString) {
        throw new Error('A positive integer number of iterations must be given to use the extension.');
    } else {
        let numIterations = parseInt(numIterationsString, 10);
        if (Number.isInteger(numIterations) && numIterations > 0) {
            await vscode.workspace.getConfiguration().update('dafny-autopilot.numIterations', numIterations, vscode.ConfigurationTarget.Global);
            return numIterations;
        } else {
            throw new Error('A positive integer number of iterations must be given to use the extension.');
        }
    }
}

export async function openDiffView(originalFilePath: string, modifiedFilePath: string) {
    const originalUri = vscode.Uri.file(originalFilePath);
    const modifiedUri = vscode.Uri.file(modifiedFilePath);

    await vscode.commands.executeCommand('vscode.diff',
        originalUri,
        modifiedUri,
        `Compare: ${path.basename(originalFilePath)} ↔ ${path.basename(modifiedFilePath)}`
    );
}

export async function callLangChain(modelName: string, filePath: string, outputChannel: vscode.OutputChannel): Promise<void> {
    try {
        // Check for Dafny path first
        let dafnyPath = vscode.workspace.getConfiguration('dafny-autopilot').get<string>('dafnyPath');
        if (!dafnyPath) {
            dafnyPath = await ensureDafnyPath();
            if (!dafnyPath) {
                throw new Error('Dafny path not provided');
            }
            // Save the provided path to settings
            await vscode.workspace.getConfiguration('dafny-autopilot').update('dafnyPath', dafnyPath, vscode.ConfigurationTarget.Global);
        }
        // Check for API key
        let apiKey: string | undefined;
        if (modelName.startsWith('gpt')) {
            apiKey = await ensureGPTApiKey();
            if (apiKey) {
                process.env.OPENAI_API_KEY = apiKey;
            }
        } else if (modelName.startsWith('claude')) {
            apiKey = await ensureClaudeApiKey();
            if (apiKey) {
                process.env.ANTHROPIC_API_KEY = apiKey;
            }
        } else if (modelName.startsWith('gemini')) {
            apiKey = await ensureGeminiApiKey();
            if (apiKey) {
                process.env.GOOGLE_API_KEY = apiKey;
            }
        } else if (modelName.startsWith('anthropic.')) {
            const {accessKeyId, secretAccessKey } = await ensureAWSCredentials();
            apiKey = accessKeyId + ':' + secretAccessKey;
            if (accessKeyId && secretAccessKey) {
                process.env.BEDROCK_AWS_ACCESS_KEY_ID = accessKeyId;
                process.env.BEDROCK_AWS_SECRET_ACCESS_KEY = secretAccessKey;
            }
        }
        if (!apiKey) {
            throw new Error('API key not found or invalid');
        }
        // Check for number of iterations
        let numIterations = vscode.workspace.getConfiguration('dafny-autopilot').get<number>('numIterations');
        if (!(numIterations && Number.isInteger(numIterations) && numIterations > 0)) {
            numIterations = await ensureNumIterations();
            if (!(numIterations && Number.isInteger(numIterations) && numIterations > 0)) {
                throw new Error('Valid number of iterations not provided');
            }
            // Save the provided number to settings
            await vscode.workspace.getConfiguration('dafny-autopilot').update('numIterations', numIterations, vscode.ConfigurationTarget.Global);
        }

        const dafnyChain = new DafnyChain(modelName, outputChannel);
        vscode.window.showInformationMessage('Filling in annotations & verifying...');
        const [newFilePath] = await dafnyChain.processDafnyFile(filePath);
        await openDiffView(filePath, newFilePath);

        // Run Dafny verification
        const { stdout, stderr } = await runDafny(filePath, newFilePath, dafnyPath);
        outputChannel.appendLine('\nDafny verification result:');
        outputChannel.appendLine(stdout);
        if (stderr) {
            outputChannel.appendLine('Errors:');
            outputChannel.appendLine(stderr);
        }

        if (stderr) {
            vscode.window.showWarningMessage('Dafny verification completed with warnings / errors. Check the output channel for details.');
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Error processing Dafny file: ${(error as Error).message}`);
    } finally {
        // Clean up environment variables
        delete process.env.OPENAI_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;
    }
}

export async function explainDafnyAnnotation(model: string, selectedText: string, outputChannel: vscode.OutputChannel) {
    let apiKey: string | undefined;
    if (model.startsWith('gpt')) {
        apiKey = await ensureGPTApiKey();
    } else if (model.startsWith('claude')) {
        apiKey = await ensureClaudeApiKey();
    } else if (model.startsWith('anthropic.')) {
        const { accessKeyId, secretAccessKey } = await ensureAWSCredentials();
        apiKey = accessKeyId + ':' + secretAccessKey;
    } else {
        vscode.window.showErrorMessage('Invalid model name.');
        return;
    }

    if (!apiKey) {
        vscode.window.showErrorMessage('API key is required to use the extension.');
        return;
    }

    const sysPrompt = prompts.SYS_DAFNY;
    const userPrompt = `Explain the following Dafny annotation in detail:\n\n${selectedText}`;

    try {
        let explanation: string | undefined;

        if (model.startsWith('gpt')) {
            explanation = await explainUsingGPT(apiKey, sysPrompt, userPrompt, model);
        } else if (model.startsWith('claude')) {
            explanation = await explainUsingClaude(apiKey, sysPrompt, userPrompt, model);
        } else if (model.startsWith('anthropic.')) {
            explanation = await explainUsingAWSBedrock(apiKey, sysPrompt, userPrompt, model);
        }

        if (explanation) {
            outputChannel.clear();
            outputChannel.appendLine('Dafny Annotation Explanation:');
            outputChannel.appendLine('----------------------------');
            outputChannel.appendLine(explanation);
            outputChannel.show(true);
        }
    } catch (error) {
        vscode.window.showErrorMessage('Error explaining Dafny annotation.');
        console.error(error);
    }
}

async function explainUsingGPT(apiKey: string, sysPrompt: string, userPrompt: string, model: string): Promise<string | undefined> {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
        model: model,
        messages: [
            { "role": "system", "content": sysPrompt },
            { "role": "user", "content": userPrompt }
        ],
    });
    return response.choices[0].message.content ?? undefined;
}

async function explainUsingClaude(apiKey: string, sysPrompt: string, userPrompt: string, model: string): Promise<string | undefined> {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
        model: model,
        max_tokens: 4096,
        system: sysPrompt,
        messages: [
            { "role": "user", "content": userPrompt }
        ]
    });
    return (response.content[0] as Anthropic.TextBlock).text;
}

async function explainUsingAWSBedrock(apiKey: string, sysPrompt: string, userPrompt: string, model: string): Promise<string | undefined> {
    const accessKeyId = apiKey.split(':')[0];
    const secretAccessKey = apiKey.split(':')[1];
    const bedrock = new ChatBedrockConverse({ 
        credentials: { accessKeyId, secretAccessKey },
        region: 'us-east-1',
        model: model,
        maxTokens: 4096
    });
    const response = await bedrock.invoke(userPrompt);
    return (response.content as string);
}