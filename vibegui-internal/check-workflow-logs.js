/**
 * Check Workflow Logs via MCP
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function checkWorkflowLogs() {
  console.log('🔍 Checking Workflow Logs via MCP');
  console.log('=================================');
  
  const runId = 'b2ece137-0641-4ab7-9091-7c408022f011';
  console.log(`Target Run ID: ${runId}`);
  console.log('');

  const client = new Client({
    name: 'workflow-logs-checker',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:49799/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // List all available tools to find workflow-related ones
    const tools = await client.listTools();
    console.log('🔧 All Available Tools:');
    tools.tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
    });
    console.log('');

    // Look for workflow-related tools
    const workflowTools = tools.tools.filter(tool => 
      tool.name.toLowerCase().includes('workflow') ||
      tool.name.toLowerCase().includes('log') ||
      tool.name.toLowerCase().includes('status') ||
      tool.name.toLowerCase().includes('history') ||
      tool.name.toLowerCase().includes('instance') ||
      tool.name.toLowerCase().includes('run')
    );

    console.log('🔍 Workflow-related tools:');
    workflowTools.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
      if (tool.inputSchema && tool.inputSchema.properties) {
        console.log(`      Input schema:`, JSON.stringify(tool.inputSchema.properties, null, 2));
      }
      console.log('');
    });

    // Try different approaches to get workflow status/logs
    for (const tool of workflowTools) {
      try {
        console.log(`\n🧪 Trying tool: ${tool.name}`);
        
        // Try with runId parameter
        if (tool.inputSchema && tool.inputSchema.properties && tool.inputSchema.properties.runId) {
          const result = await client.callTool({
            name: tool.name,
            arguments: { runId: runId }
          });
          console.log(`✅ Result from ${tool.name}:`, JSON.stringify(result.structuredContent, null, 2));
        }
        // Try with id parameter
        else if (tool.inputSchema && tool.inputSchema.properties && tool.inputSchema.properties.id) {
          const result = await client.callTool({
            name: tool.name,
            arguments: { id: runId }
          });
          console.log(`✅ Result from ${tool.name}:`, JSON.stringify(result.structuredContent, null, 2));
        }
        // Try with workflowId parameter
        else if (tool.inputSchema && tool.inputSchema.properties && tool.inputSchema.properties.workflowId) {
          const result = await client.callTool({
            name: tool.name,
            arguments: { workflowId: 'PROCESS_BLOG_POST' }
          });
          console.log(`✅ Result from ${tool.name}:`, JSON.stringify(result.structuredContent, null, 2));
        }
        // Try without parameters
        else if (!tool.inputSchema || !tool.inputSchema.properties || Object.keys(tool.inputSchema.properties).length === 0) {
          const result = await client.callTool({
            name: tool.name,
            arguments: {}
          });
          console.log(`✅ Result from ${tool.name}:`, JSON.stringify(result.structuredContent, null, 2));
        }
      } catch (error) {
        console.log(`❌ Error with ${tool.name}:`, error.message);
      }
    }

    // Also try to access via web fetch if there's a URL-based API
    console.log('\n🌐 Trying to access workflow URL directly...');
    try {
      // This won't work directly but let's see what happens
      const webResult = await client.callTool({
        name: 'DECO_CHAT_VIEWS_LIST',
        arguments: {}
      });
      console.log('Views available:', JSON.stringify(webResult.structuredContent, null, 2));
    } catch (webError) {
      console.log('❌ Web access failed:', webError.message);
    }

  } catch (error) {
    console.error('❌ Error checking workflow logs:', error.message);
  } finally {
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }
}

checkWorkflowLogs().catch(console.error);