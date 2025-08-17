/**
 * Direct MCP endpoint test
 * This tests the MCP server directly via HTTP calls
 */

const http = require('http');

// Local development server
const MCP_URL = 'http://localhost:56791';

function makeRequest(path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 56791,
      path: path,
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testMCPEndpoints() {
  console.log('🔬 Testing MCP Server Endpoints');
  console.log('================================');
  console.log(`Base URL: ${MCP_URL}`);
  console.log('');

  try {
    // Test 1: Check if MCP endpoint exists
    console.log('Test 1: MCP Root Endpoint');
    const mcpRoot = await makeRequest('/mcp');
    console.log('Status:', mcpRoot.status);
    if (mcpRoot.status === 200) {
      console.log('✅ MCP endpoint accessible');
      if (mcpRoot.data.tools) {
        console.log(`Found ${mcpRoot.data.tools.length} tools`);
      }
      if (mcpRoot.data.workflows) {
        console.log(`Found ${mcpRoot.data.workflows.length} workflows`);
      }
    } else {
      console.log('❌ MCP endpoint not accessible');
    }
    console.log('');

    // Test 2: Try calling a simple tool
    console.log('Test 2: DETECT_LANGUAGE Tool');
    const detectLanguageTest = await makeRequest('/mcp/call-tool/DETECT_LANGUAGE', {
      content: "Todo dia eu durmo feliz por saber que a minha empresa não vende vício, jogo e aposta pra pagar as contas. Boa noite!"
    });
    console.log('Status:', detectLanguageTest.status);
    if (detectLanguageTest.status === 200) {
      console.log('✅ Language detection working');
      console.log('Result:', detectLanguageTest.data);
    } else {
      console.log('❌ Language detection failed');
      console.log('Response:', detectLanguageTest.data);
    }
    console.log('');

    // Test 3: Try LIST_BLOG_POSTS (should work even with empty DB)
    console.log('Test 3: LIST_BLOG_POSTS Tool');
    const listPostsTest = await makeRequest('/mcp/call-tool/LIST_BLOG_POSTS', {
      limit: 5
    });
    console.log('Status:', listPostsTest.status);
    if (listPostsTest.status === 200) {
      console.log('✅ List blog posts working');
      console.log('Result:', listPostsTest.data);
    } else {
      console.log('❌ List blog posts failed');
      console.log('Response:', listPostsTest.data);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('1. Make sure the development server is running');
    console.log('2. Check the tunnel URL in your terminal output');
    console.log('3. The URL might be different from localhost-5066f419.deco.host');
  }
}

// Run the tests
testMCPEndpoints();