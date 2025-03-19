import { PromptGenerator, PromptType } from '../PromptGeneration'; // Update with correct import path
import { CohereClient } from 'cohere-ai';

// Mock the cohere-ai module
jest.mock('cohere-ai', () => {
  return {
    CohereClient: jest.fn().mockImplementation(() => ({
      chat: jest.fn()
    }))
  };
});

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('PromptGenerator', () => {
  // Store original env
  const originalEnv = process.env;
  let mockCohere: jest.Mocked<CohereClient>;
  
  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    process.env.COHERE_API_KEY = 'mock-api-key';
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get instance of mock CohereClient for assertions
    mockCohere = new CohereClient({}) as jest.Mocked<CohereClient>;
  });
  
  afterAll(() => {
    // Restore original env after all tests
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with API key from environment', () => {
      const generator = new PromptGenerator();
      expect(CohereClient).toHaveBeenCalledWith({
        token: 'mock-api-key'
      });
    });

    it('should throw error when API key is missing', () => {
      delete process.env.COHERE_API_KEY;
      expect(() => new PromptGenerator()).toThrow('Missing COHERE_API_KEY');
    });
  });

  describe('generatePrompt', () => {
    const mockTask = { 
      name: 'Test Task',
      dataRequirements: {
        outputs: {
          produces: { result: 'string' }
        }
      }
    };
    const mockGlobalContext = { url: 'https://example.com' };
    const mockExtractedData = { title: 'Example Page' };
    const mockResponse = { text: 'Generated prompt response' };
    
    let generator: PromptGenerator;
    
    beforeEach(() => {
      generator = new PromptGenerator();
      // Setup the mock response
      (CohereClient.prototype.chat as jest.Mock).mockResolvedValue(mockResponse);
    });

    it('should generate OBSERVE type prompt correctly', async () => {
      const result = await generator.generatePrompt(mockTask, mockGlobalContext, PromptType.OBSERVE);
      
      // Verify cohere.chat was called with the correct prompt
      expect(CohereClient.prototype.chat).toHaveBeenCalledWith({
        model: 'command',
        message: expect.stringContaining('Task:')
      });
      
      // Verify the message contains the expected content
      const callArg = (CohereClient.prototype.chat as jest.Mock).mock.calls[0][0].message;
      expect(callArg).toContain(JSON.stringify(mockTask, null, 2));
      expect(callArg).toContain(JSON.stringify(mockGlobalContext, null, 2));
      expect(callArg).toContain('what should be observed or acted on next');
      
      // Verify returned result
      expect(result).toBe('Generated prompt response');
    });

    it('should generate EXTRACT type prompt correctly', async () => {
      const result = await generator.generatePrompt(mockTask, mockGlobalContext, PromptType.EXTRACT);
      
      const callArg = (CohereClient.prototype.chat as jest.Mock).mock.calls[0][0].message;
      expect(callArg).toContain('What specific data should be extracted');
      expect(result).toBe('Generated prompt response');
    });

    it('should generate PRODUCE_OUTPUT type prompt correctly', async () => {
      const result = await generator.generatePrompt(
        mockTask, 
        mockGlobalContext, 
        PromptType.PRODUCE_OUTPUT, 
        mockExtractedData
      );
      
      const callArg = (CohereClient.prototype.chat as jest.Mock).mock.calls[0][0].message;
      expect(callArg).toContain('Extracted Data:');
      expect(callArg).toContain(JSON.stringify(mockExtractedData, null, 2));
      expect(callArg).toContain('produce a JSON object');
      expect(result).toBe('Generated prompt response');
    });

    it('should throw error for unsupported prompt type', async () => {
      await expect(
        generator.generatePrompt(mockTask, mockGlobalContext, 'invalid' as PromptType)
      ).rejects.toThrow('Unsupported prompt type: invalid');
    });

    it('should handle API errors gracefully', async () => {
      // Mock the API error
      (CohereClient.prototype.chat as jest.Mock).mockRejectedValue(new Error('API error'));
      
      // Use a try-catch inside the test to verify error propagation
      try {
        await generator.generatePrompt(mockTask, mockGlobalContext, PromptType.OBSERVE);
        fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('API error');
      }
    });
  });

  describe('buildPrompt (private method test)', () => {
    it('should build prompts with correct structure', () => {
      // We need to access the private method for testing
      // This is a common approach to test private methods in TypeScript
      const generator = new PromptGenerator() as any;
      const mockTask = { name: 'Test' };
      const mockContext = { data: 'Context' };
      
      const observePrompt = generator.buildPrompt(mockTask, mockContext, PromptType.OBSERVE);
      expect(observePrompt).toContain('Task:');
      expect(observePrompt).toContain('Global Context:');
      expect(observePrompt).toContain('what should be observed or acted on next');
      
      const extractPrompt = generator.buildPrompt(mockTask, mockContext, PromptType.EXTRACT);
      expect(extractPrompt).toContain('What specific data should be extracted');
      
      const outputPrompt = generator.buildPrompt(
        mockTask, 
        mockContext, 
        PromptType.PRODUCE_OUTPUT, 
        { data: 'extracted' }
      );
      expect(outputPrompt).toContain('Extracted Data:');
      expect(outputPrompt).toContain('produce a JSON object');
    });
  });
});