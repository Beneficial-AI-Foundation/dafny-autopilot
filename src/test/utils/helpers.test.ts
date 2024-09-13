import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ensureGPTApiKey, askGPTApiKey, ensureClaudeApiKey, askClaudeApiKey, ensureGeminiApiKey, askGeminiApiKey } from '../../utils/helpers';
import * as assert from 'assert';


suite('Test Helpers', function() {
    let sandbox: sinon.SinonSandbox;

    setup(function() {
        // Create a sandbox for stubbing
        sandbox = sinon.createSandbox();
    });

    teardown(function() {
        // Restore all the stubs
        sandbox.restore();
    });

    test('should return OpenAI API key from the configuration if it exists', async function() {
        // Stub the vscode.workspace.getConfiguration to return an object that
        // has a get method which returns 'test-api-key' when 'openai.apiKey' is passed
        const configStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().withArgs('openai.apiKey').returns('test-api-key'),
            has: sandbox.stub(),
            update: sandbox.stub(),
            inspect: sandbox.stub()
        });

        // Call the function under test
        const result = await ensureGPTApiKey();

        // Assert the expected result
        assert.strictEqual(result, 'test-api-key');
    });

    test('askGPTApiKey should return OpenAI API key stored in the configuration when provided', async function() {
        // Extend the stub to include all necessary methods
        const configStub = {
            get: sandbox.stub().withArgs('openai.apiKey').resolves('test-api-key'),
            update: sandbox.stub().resolves(),
            has: sandbox.stub().returns(true),
            inspect: sandbox.stub().returns({})
        };

        // Stub getConfiguration to return the extended stub
        sandbox.stub(vscode.workspace, 'getConfiguration').returns(configStub);

        // Stub showInputBox to simulate user input
        sandbox.stub(vscode.window, 'showInputBox').resolves('test-api-key');

        const key = await askGPTApiKey();
        assert.strictEqual(key, 'test-api-key', "The API key should be 'test-api-key'");

        // Check if the update was called correctly
        sinon.assert.calledWithExactly(configStub.update, 'openai.apiKey', 'test-api-key', vscode.ConfigurationTarget.Global);
    });

    test('askGPTApiKey should prompt user for OpenAI API key', function(done) {
        this.timeout(5000);
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('test-api-key');

        askGPTApiKey().then(apiKey => {
            // Assert that the API key returned is as expected
            assert.strictEqual(apiKey, 'test-api-key', "The API key should match the mocked response");
    
            // Assert that showInputBox was called with the expected options
            sinon.assert.calledWithExactly(showInputBoxStub, {
                prompt: 'Please enter your OpenAI API key.',
                ignoreFocusOut: true,
                password: true,
                placeHolder: 'Enter your OpenAI API key',
            });
    
            done();  // Explicitly marks the test as done successfully
        }).catch(error => {
            // If there is an error in the promise, pass it to 'done' to fail the test
            done(error);
        });
    });

    test('should return Anthropic API key from the configuration if it exists', async function() {
        // Stub the vscode.workspace.getConfiguration to return an object that
        // has a get method which returns 'test-api-key' when 'anthropic.apiKey' is passed
        const configStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().withArgs('anthropic.apiKey').returns('test-api-key'),
            has: sandbox.stub(),
            update: sandbox.stub(),
            inspect: sandbox.stub()
        });

        // Call the function under test
        const result = await ensureClaudeApiKey();

        // Assert the expected result
        assert.strictEqual(result, 'test-api-key');
    });

    test('askClaudeApiKey should return Anthropic API key stored in the configuration when provided', async function() {
        // Extend the stub to include all necessary methods
        const configStub = {
            get: sandbox.stub().withArgs('anthropic.apiKey').resolves('test-api-key'),
            update: sandbox.stub().resolves(),
            has: sandbox.stub().returns(true),
            inspect: sandbox.stub().returns({})
        };

        // Stub getConfiguration to return the extended stub
        sandbox.stub(vscode.workspace, 'getConfiguration').returns(configStub);

        // Stub showInputBox to simulate user input
        sandbox.stub(vscode.window, 'showInputBox').resolves('test-api-key');

        const key = await askClaudeApiKey();
        assert.strictEqual(key, 'test-api-key', "The API key should be 'test-api-key'");

        // Check if the update was called correctly
        sinon.assert.calledWithExactly(configStub.update, 'anthropic.apiKey', 'test-api-key', vscode.ConfigurationTarget.Global);
    });

    test('askClaudeApiKey should prompt user for Anthropic API key', function(done) {
        this.timeout(5000);
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('test-api-key');

        askClaudeApiKey().then(apiKey => {
            // Assert that the API key returned is as expected
            assert.strictEqual(apiKey, 'test-api-key', "The API key should match the mocked response");
    
            // Assert that showInputBox was called with the expected options
            sinon.assert.calledWithExactly(showInputBoxStub, {
                prompt: 'Please enter your Anthropic API key.',
                ignoreFocusOut: true,
                password: true,
                placeHolder: 'Enter your Anthropic API key',
            });
    
            done();  // Explicitly marks the test as done successfully
        }).catch(error => {
            // If there is an error in the promise, pass it to 'done' to fail the test
            done(error);
        });
    });

    test('should return Google API key from the configuration if it exists', async function() {
        // Stub the vscode.workspace.getConfiguration to return an object that
        // has a get method which returns 'test-api-key' when 'google.apiKey' is passed
        const configStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().withArgs('google.apiKey').returns('test-api-key'),
            has: sandbox.stub(),
            update: sandbox.stub(),
            inspect: sandbox.stub()
        });

        // Call the function under test
        const result = await ensureGeminiApiKey();

        // Assert the expected result
        assert.strictEqual(result, 'test-api-key');
    });

    test('askGeminiApiKey should return Google API key stored in the configuration when provided', async function() {
        // Extend the stub to include all necessary methods
        const configStub = {
            get: sandbox.stub().withArgs('google.apiKey').resolves('test-api-key'),
            update: sandbox.stub().resolves(),
            has: sandbox.stub().returns(true),
            inspect: sandbox.stub().returns({})
        };

        // Stub getConfiguration to return the extended stub
        sandbox.stub(vscode.workspace, 'getConfiguration').returns(configStub);

        // Stub showInputBox to simulate user input
        sandbox.stub(vscode.window, 'showInputBox').resolves('test-api-key');

        const key = await askGeminiApiKey();
        assert.strictEqual(key, 'test-api-key', "The API key should be 'test-api-key'");

        // Check if the update was called correctly
        sinon.assert.calledWithExactly(configStub.update, 'google.apiKey', 'test-api-key', vscode.ConfigurationTarget.Global);
    });

    test('askGeminiApiKey should prompt user for Google API key', function(done) {
        this.timeout(5000);
        const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('test-api-key');

        askGeminiApiKey().then(apiKey => {
            // Assert that the API key returned is as expected
            assert.strictEqual(apiKey, 'test-api-key', "The API key should match the mocked response");
    
            // Assert that showInputBox was called with the expected options
            sinon.assert.calledWithExactly(showInputBoxStub, {
                prompt: 'Please enter your Google API key.',
                ignoreFocusOut: true,
                password: true,
                placeHolder: 'Enter your Google API key',
            });
    
            done();  // Explicitly marks the test as done successfully
        }).catch(error => {
            // If there is an error in the promise, pass it to 'done' to fail the test
            done(error);
        });
    });
});
