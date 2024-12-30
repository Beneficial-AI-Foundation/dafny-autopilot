import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import OpenAI from 'openai';
import * as myExtension from '../extension';
import * as fs from 'fs';
import * as path from 'path';
import * as helpers from '../utils/helpers';
import * as dafnyHelpers from '../utils/dafny-helpers';
import { DafnyChain } from '../utils/langchain/dafny-chain';

let isExtensionActivated = false;


suite('Extension Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let context: vscode.ExtensionContext;
    let chatCompletionsCreateStub: sinon.SinonStub;
    let callFillHintsStub: sinon.SinonStub;

    setup(async () => {
        sandbox = sinon.createSandbox();
        context = {
            subscriptions: [],
            workspaceState: {
                get: () => {},
                update: () => Promise.resolve()
            },
            globalState: {
                get: () => {},
                update: () => Promise.resolve()
            },
            extensionUri: vscode.Uri.file(__dirname),
            extensionPath: __dirname,
            asAbsolutePath: (relativePath: string) => path.join(__dirname, relativePath),
            storagePath: undefined,
            globalStoragePath: __dirname,
            logPath: __dirname,
        } as any;
        // Create a stubbed instance of OpenAI
        sandbox.stub(OpenAI, 'OpenAI').callsFake(function(this: any) {
            this.chat = {
                completions: {
                    create: chatCompletionsCreateStub = sandbox.stub().resolves({
                        choices: [{ message: { content: 'Mocked OpenAI response' } }]
                    })
                }
            };
            // Add other necessary properties to match the OpenAI structure
            this.completions = { create: sandbox.stub() };
            this.models = { retrieve: sandbox.stub() };
            // ... add other properties as needed
            return this;
        });
        callFillHintsStub = sandbox.stub(helpers, 'callFillHints').resolves();
        // Activate the extension only once
        if (!isExtensionActivated) {
            await myExtension.activate(context);
            isExtensionActivated = true;
        }

    });


    teardown(() => {
        sandbox.restore();
    });


	test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('BeneficialAIFoundation.dafny-autopilot'));
    });


    test('Should register commands', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('dafny-autopilot.GPTFillHints'));
        assert.ok(commands.includes('dafny-autopilot.ClaudeFillHints'));
        assert.ok(commands.includes('dafny-autopilot.GPTTranslatePython'));
        assert.ok(commands.includes('dafny-autopilot.ClaudeTranslatePython'));
    });


    test('Should prompt for OpenAI API key if not set', async () => {
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('test-api-key');
        const getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === 'openai.apiKey') {return undefined;}
                if (key === 'dafny-autopilot.dafnyPath') {return '/path/to/dafny';} // Provide a fake Dafny path
                return 'some-value';
            }),
            update: sandbox.stub().resolves()
        } as any);
    
        sandbox.stub(fs.promises, 'readFile').resolves('dummy content');
        sandbox.stub(fs.promises, 'writeFile').resolves();
        sandbox.stub(vscode.window, 'showTextDocument').resolves();
    
        callFillHintsStub.callsFake(async (model, filePath, newFileName) => {
            if (model.startsWith('gpt')) {
                await helpers.ensureGPTApiKey();
            }
        });
        const uri = vscode.Uri.file(path.join(__dirname, '..', '..', 'src', 'test', 'test.dfy'));
        await new Promise<void>(resolve => {
            vscode.commands.executeCommand('dafny-autopilot.GPTFillHints', uri);
            setTimeout(resolve, 100);  // Adjust this delay as needed
        });
    
        assert.ok(showInputBoxStub.calledWith({
            prompt: 'Please enter your OpenAI API key.',
            ignoreFocusOut: true,
            password: true,
            placeHolder: 'Enter your OpenAI API key'
        }));
    });


    test('Should prompt for Anthropic API key if not set', async () => {
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('test-api-key');
        const getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === 'anthropic.apiKey') {return undefined;}
                if (key === 'dafny-autopilot.dafnyPath') {return '/path/to/dafny';} // Provide a fake Dafny path
                return 'some-value';
            }),
            update: sandbox.stub().resolves()
        } as any);
        
        sandbox.stub(fs.promises, 'readFile').resolves('dummy content');
        sandbox.stub(fs.promises, 'writeFile').resolves();
        sandbox.stub(vscode.window, 'showTextDocument').resolves();
    
        // Modify callFillHints stub to actually call ensureClaudeApiKey
        callFillHintsStub.callsFake(async (model, filePath, newFileName) => {
            if (model.startsWith('claude')) {
                await helpers.ensureClaudeApiKey();
            }
        });

        const uri = vscode.Uri.file(path.join(__dirname, '..', '..', 'src', 'test', 'test.dfy'));
        await new Promise<void>(resolve => {
            vscode.commands.executeCommand('dafny-autopilot.ClaudeFillHints', uri);
            setTimeout(resolve, 350);  // Adjust this delay as needed
        });
    
        assert.ok(showInputBoxStub.calledWith({
            prompt: 'Please enter your Anthropic API key.',
            ignoreFocusOut: true,
            password: true,
            placeHolder: 'Enter your Anthropic API key'
        }));
    });


    test('Should prompt for Google API key if not set', async () => {
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('test-api-key');
        const getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === 'google.apiKey') {return undefined;}
                if (key === 'dafny-autopilot.dafnyPath') {return '/path/to/dafny';} // Provide a fake Dafny path
                return 'some-value';
            }),
            update: sandbox.stub().resolves()
        } as any);

        sandbox.stub(fs.promises, 'readFile').resolves('dummy content');
        sandbox.stub(fs.promises, 'writeFile').resolves();
        sandbox.stub(vscode.window, 'showTextDocument').resolves();
    
        // Modify callFillHints stub to actually call ensureGeminiApiKey
        callFillHintsStub.callsFake(async (model, filePath, newFileName) => {
            if (model.startsWith('gemini')) {
                await helpers.ensureGeminiApiKey();
            }
        });

        const uri = vscode.Uri.file(path.join(__dirname, '..', '..', 'src', 'test', 'test.dfy'));
        await new Promise<void>(resolve => {
            vscode.commands.executeCommand('dafny-autopilot.GeminiFillHints', uri);
            setTimeout(resolve, 350);  // Adjust this delay as needed
        });
    
        assert.ok(showInputBoxStub.calledWith({
            prompt: 'Please enter your Google API key.',
            ignoreFocusOut: true,
            password: true,
            placeHolder: 'Enter your Google API key'
        }));
    });


    test('Should prompt for Dafny path if not set (when using GPT)', async () => {
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('test-dafny-path');
        const getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === 'dafny-autopilot.dafnyPath') {return undefined;}
                if (key === 'openai.apiKey') {return 'fake-api-key';}
                return 'some-value';
            }),
            update: sandbox.stub().resolves()
        } as any);
    
        callFillHintsStub.callsFake(async (model, filePath, newFileName) => {
            await dafnyHelpers.ensureDafnyPath();
        });
    
        const uri = vscode.Uri.file(path.join(__dirname, '..', '..', 'src', 'test', 'test.dfy'));
        await vscode.commands.executeCommand('dafny-autopilot.GPTFillHints', uri);
    
        sinon.assert.calledWith(showInputBoxStub, {
            prompt: 'Please enter the path to the Dafny executable.',
            ignoreFocusOut: true,
            placeHolder: 'Enter the path to the Dafny executable'
        });
    });
    

    test('Should prompt for Dafny path if not set (when using Claude)', async () => {
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('test-dafny-path');
        const getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === 'dafny-autopilot.dafnyPath') {return undefined;}
                if (key === 'claude.apiKey') {return 'fake-api-key';}
                return 'some-value';
            }),
            update: sandbox.stub().resolves()
        } as any);
    
        callFillHintsStub.callsFake(async (model, filePath, newFileName) => {
            await dafnyHelpers.ensureDafnyPath();
        });
    
        const uri = vscode.Uri.file(path.join(__dirname, '..', '..', 'src', 'test', 'test.dfy'));
        await vscode.commands.executeCommand('dafny-autopilot.ClaudeFillHints', uri);
    
        sinon.assert.calledWith(showInputBoxStub, {
            prompt: 'Please enter the path to the Dafny executable.',
            ignoreFocusOut: true,
            placeHolder: 'Enter the path to the Dafny executable'
        });
    });

    test('Should handle AWS region from credentials or prompt', async () => {
        const outputChannel = vscode.window.createOutputChannel("Test Channel");
        
        process.env.BEDROCK_AWS_ACCESS_KEY_ID = 'test-key';
        process.env.BEDROCK_AWS_SECRET_ACCESS_KEY = 'test-secret';
        
        const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick')
            .resolves({ label: 'us-west-2', description: 'US West (Oregon)' });
        
        try {
            const dafnyChain = new DafnyChain('anthropic.claude-1234', outputChannel);
            await dafnyChain['initializeDependencies']();
            
            assert.ok(showQuickPickStub.calledOnce);
        } finally {
            // Clean up
            delete process.env.BEDROCK_AWS_ACCESS_KEY_ID;
            delete process.env.BEDROCK_AWS_SECRET_ACCESS_KEY;
            outputChannel.dispose();
        }
    });
});
