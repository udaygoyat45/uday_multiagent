import { WebAgent } from "../WebAgent";

let webAgent: WebAgent;

beforeAll(() => {
    webAgent = new WebAgent(true);
});

afterAll(async () => {
    await webAgent.destroyAllBrowsers();
});

test('should create a new browser context', async () => {
    const contextId = await webAgent.createBrowserContext();
    expect(contextId).toBeDefined();
    await new Promise(resolve => setTimeout(resolve, 10000));
}, 100000);

// test('should create and store multiple browser contexts', async () => {
//     const contextId1 = await webAgent.createBrowserContext();
//     const contextId2 = await webAgent.createBrowserContext();
//     expect(contextId1).not.toBe(contextId2);
// }, 20000);

// test('should destroy a browser context', async () => {
//     const contextId = await webAgent.createBrowserContext();
//     await webAgent.destroyBrowserContext(contextId);
//     await expect(webAgent.destroyBrowserContext(contextId)).resolves.not.toThrow();
// }, 20000);

// test('doordash login', async() => {
    
// })