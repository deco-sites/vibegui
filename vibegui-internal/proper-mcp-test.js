/**
 * Proper MCP Client Test using the official @modelcontextprotocol/sdk
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testMCPConnection() {
  console.log('🧪 MCP Client Test using Official SDK');
  console.log('======================================');
  console.log('Target: http://localhost:51305/mcp');
  console.log('');

  const client = new Client({
    name: 'mcp-sdk-test-client',
    version: '1.0.0'
  });

  try {
    // Use StreamableHTTPClientTransport for HTTP MCP servers
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:51305/mcp'));
    
    console.log('Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected to MCP server successfully!');

    // List all available tools
    console.log('\nTest 1: List Available Tools');
    const tools = await client.listTools();
    console.log(`✅ Found ${tools.tools.length} tools:`);
    
    tools.tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name}`);
      console.log(`      Description: ${tool.description}`);
      if (tool.inputSchema) {
        console.log(`      Input: ${JSON.stringify(tool.inputSchema.properties || {}, null, 2)}`);
      }
      console.log('');
    });

    // Test calling a specific tool
    console.log('Test 2: Call DETECT_LANGUAGE Tool');
    try {
      const languageResult = await client.callTool({
        name: 'DETECT_LANGUAGE',
        arguments: {
          content: 'Este é um teste em português para detectar o idioma usando o SDK oficial do MCP.'
        }
      });
      console.log('✅ DETECT_LANGUAGE tool call successful:');
      console.log(JSON.stringify(languageResult, null, 2));
    } catch (toolError) {
      console.log('❌ DETECT_LANGUAGE tool call failed:', toolError.message);
    }

    console.log('');

    // Test calling workflow tools if they exist
    console.log('Test 3: Look for Workflow Tools');
    const workflowTools = tools.tools.filter(tool => 
      tool.name.includes('WORKFLOW') || 
      tool.name.includes('PROCESS_BLOG_POST') ||
      tool.name.includes('DECO_CHAT_WORKFLOWS')
    );
    
    if (workflowTools.length > 0) {
      console.log(`✅ Found ${workflowTools.length} workflow tools:`);
      workflowTools.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
      });

      // Try to call a workflow start tool
      const startWorkflowTool = workflowTools.find(tool => 
        tool.name.includes('START_PROCESS_BLOG_POST')
      );
      
      if (startWorkflowTool) {
        console.log('\nTest 4: Start PROCESS_BLOG_POST Workflow');
        try {
          const workflowResult = await client.callTool({
            name: startWorkflowTool.name,
            arguments: {
              id: 'mcp-sdk-test-post-123',
              slug: 'mcp-sdk-test-post-123',
              content: 'Este é um teste completo do workflow usando o SDK oficial. Deve detectar português, gerar título e resumo, e salvar no banco.',
              title: '',
              excerpt: '',
              authorName: 'MCP SDK Test',
              publishedDate: '2024-12-17',
              interactionCount: 1
            }
          });
          console.log('✅ Workflow start successful:');
          console.log(JSON.stringify(workflowResult, null, 2));
        } catch (workflowError) {
          console.log('❌ Workflow start failed:', workflowError.message);
        }
      }
    } else {
      console.log('❌ No workflow tools found');
    }

  } catch (error) {
    console.error('❌ MCP connection failed:', error.message);
    
    // Fallback: Try basic HTTP requests if SDK fails
    console.log('\n🔄 Trying fallback HTTP approach...');
    await testHTTPFallback();
  } finally {
    // Clean up connection
    try {
      await client.close();
      console.log('✅ MCP client closed successfully');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }

  console.log('');
  console.log('🎉 MCP SDK Test Complete');
}

async function testHTTPFallback() {
  try {
    const toolsResponse = await fetch('http://localhost:51305/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });

    if (toolsResponse.ok) {
      const toolsResult = await toolsResponse.json();
      console.log('✅ Fallback HTTP request successful:');
      if (toolsResult.result && toolsResult.result.tools) {
        console.log(`Found ${toolsResult.result.tools.length} tools via HTTP fallback`);
      } else {
        console.log('Raw response:', JSON.stringify(toolsResult, null, 2));
      }
    } else {
      console.log(`❌ HTTP fallback failed: ${toolsResponse.status} ${toolsResponse.statusText}`);
    }
  } catch (httpError) {
    console.log('❌ HTTP fallback error:', httpError.message);
  }
}

testMCPConnection().catch(console.error);