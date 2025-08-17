/**
 * Proper MCP Client Test
 * This implements the MCP streaming protocol to list tools and test workflows
 */
// Try to import EventSource - might need different import in Node.js
let EventSource;
try {
  EventSource = require('eventsource');
} catch (e) {
  try {
    EventSource = global.EventSource;
  } catch (e2) {
    EventSource = null;
    console.log('⚠️ EventSource not available');
  }
}
const http = require('http');

class MCPClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.requestId = 1;
  }

  // Send a JSON-RPC request via POST
  async sendRequest(method, params = {}) {
    const requestData = {
      jsonrpc: "2.0",
      id: this.requestId++,
      method: method,
      params: params
    };

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestData);
      
      const options = {
        hostname: 'localhost',
        port: 51305,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.error) {
              reject(new Error(`MCP Error: ${response.error.message}`));
            } else {
              resolve(response.result);
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(postData);
      req.end();
    });
  }

  // Initialize MCP connection
  async initialize() {
    try {
      const result = await this.sendRequest('initialize', {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          sampling: {}
        },
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        }
      });
      console.log('✅ MCP initialized successfully');
      return result;
    } catch (error) {
      console.log('❌ MCP initialization failed:', error.message);
      throw error;
    }
  }

  // List all available tools
  async listTools() {
    try {
      const result = await this.sendRequest('tools/list', {});
      return result;
    } catch (error) {
      console.log('❌ Failed to list tools:', error.message);
      throw error;
    }
  }

  // Call a specific tool
  async callTool(name, arguments_) {
    try {
      const result = await this.sendRequest('tools/call', {
        name: name,
        arguments: arguments_
      });
      return result;
    } catch (error) {
      console.log(`❌ Failed to call tool ${name}:`, error.message);
      throw error;
    }
  }

  // List workflows (if supported)
  async listWorkflows() {
    try {
      const result = await this.sendRequest('workflows/list', {});
      return result;
    } catch (error) {
      console.log('❌ Failed to list workflows:', error.message);
      throw error;
    }
  }

  // Start a workflow
  async startWorkflow(name, arguments_) {
    try {
      const result = await this.sendRequest('workflows/start', {
        name: name,
        arguments: arguments_
      });
      return result;
    } catch (error) {
      console.log(`❌ Failed to start workflow ${name}:`, error.message);
      throw error;
    }
  }
}

// Alternative: Try Server-Sent Events approach
function testMCPStreaming() {
  return new Promise((resolve, reject) => {
    if (!EventSource) {
      reject(new Error('EventSource not available'));
      return;
    }

    console.log('🔄 Trying Server-Sent Events approach...');
    
    const eventSource = new EventSource('http://localhost:51305/mcp');
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection opened');
    };
    
    eventSource.onmessage = (event) => {
      console.log('📨 Received message:', event.data);
      try {
        const data = JSON.parse(event.data);
        resolve(data);
      } catch (e) {
        console.log('Raw message:', event.data);
        resolve({ raw: event.data });
      }
    };
    
    eventSource.onerror = (error) => {
      console.log('❌ SSE error:', error);
      eventSource.close();
      reject(error);
    };
    
    // Close after 5 seconds
    setTimeout(() => {
      eventSource.close();
      reject(new Error('SSE timeout'));
    }, 5000);
  });
}

async function runMCPTests() {
  console.log('🧪 MCP Client Test Suite');
  console.log('========================');
  console.log('Target: http://localhost:51305/mcp');
  console.log('');

  const client = new MCPClient('http://localhost:51305');

  try {
    // Test 1: Try to initialize MCP connection
    console.log('Test 1: Initialize MCP Connection');
    try {
      const initResult = await client.initialize();
      console.log('✅ Initialization successful:', JSON.stringify(initResult, null, 2));
    } catch (error) {
      console.log('❌ Initialization failed, trying alternative approaches...');
    }
    console.log('');

    // Test 2: Try to list tools
    console.log('Test 2: List Available Tools');
    try {
      const tools = await client.listTools();
      console.log('✅ Tools found:');
      if (tools && tools.tools) {
        tools.tools.forEach((tool, index) => {
          console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
        });
      } else {
        console.log('   Raw response:', JSON.stringify(tools, null, 2));
      }
    } catch (error) {
      console.log('❌ Failed to list tools via JSON-RPC');
    }
    console.log('');

    // Test 3: Try to list workflows
    console.log('Test 3: List Available Workflows');
    try {
      const workflows = await client.listWorkflows();
      console.log('✅ Workflows found:');
      if (workflows && workflows.workflows) {
        workflows.workflows.forEach((workflow, index) => {
          console.log(`   ${index + 1}. ${workflow.name} - ${workflow.description}`);
        });
      } else {
        console.log('   Raw response:', JSON.stringify(workflows, null, 2));
      }
    } catch (error) {
      console.log('❌ Failed to list workflows via JSON-RPC');
    }
    console.log('');

    // Test 4: Try to call a simple tool
    console.log('Test 4: Call DETECT_LANGUAGE Tool');
    try {
      const result = await client.callTool('DETECT_LANGUAGE', {
        content: 'Este é um teste em português para detectar o idioma.'
      });
      console.log('✅ Tool call successful:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Failed to call tool');
    }
    console.log('');

    // Test 5: Try to start a workflow
    console.log('Test 5: Start PROCESS_BLOG_POST Workflow');
    try {
      const workflowResult = await client.startWorkflow('PROCESS_BLOG_POST', {
        id: 'mcp-test-post-456',
        slug: 'mcp-test-post-456',
        content: 'Este é um teste do workflow via cliente MCP. Deve detectar português e gerar título e resumo.',
        title: '',
        excerpt: '',
        authorName: 'MCP Test Client',
        publishedDate: '2024-12-17',
        interactionCount: 1
      });
      console.log('✅ Workflow started successfully:', JSON.stringify(workflowResult, null, 2));
    } catch (error) {
      console.log('❌ Failed to start workflow');
    }
    console.log('');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }

  // Test 6: Try Server-Sent Events approach
  console.log('Test 6: Server-Sent Events Approach');
  try {
    const sseResult = await testMCPStreaming();
    console.log('✅ SSE successful:', JSON.stringify(sseResult, null, 2));
  } catch (error) {
    console.log('❌ SSE failed:', error.message);
  }

  console.log('');
  console.log('🎉 MCP Test Suite Complete');
  console.log('===========================');
}

// Run the tests
runMCPTests().catch(console.error);