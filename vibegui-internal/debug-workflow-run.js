/**
 * Debug Workflow Run - Find the right tool to get run information
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function debugWorkflowRun() {
  console.log('🔍 Debug Workflow Run by ID');
  console.log('============================');
  
  const runId = 'b2ece137-0641-4ab7-9091-7c408022f011';
  console.log(`Target Run ID: ${runId}`);
  console.log('');

  const client = new Client({
    name: 'workflow-run-debugger',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:53017/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Get all tools and analyze them carefully
    const tools = await client.listTools();
    
    console.log('🔍 Looking for workflow/run related tools...');
    
    // Look for ANY tool that might give us run information
    const potentialTools = tools.tools.filter(tool => {
      const name = tool.name.toLowerCase();
      const desc = tool.description.toLowerCase();
      return (
        name.includes('workflow') ||
        name.includes('run') ||
        name.includes('instance') ||
        name.includes('execution') ||
        name.includes('status') ||
        name.includes('log') ||
        name.includes('history') ||
        name.includes('get') ||
        name.includes('fetch') ||
        desc.includes('workflow') ||
        desc.includes('run') ||
        desc.includes('instance') ||
        desc.includes('execution') ||
        desc.includes('status') ||
        desc.includes('log')
      );
    });

    console.log(`Found ${potentialTools.length} potentially relevant tools:`);
    potentialTools.forEach((tool, index) => {
      console.log(`\n${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      if (tool.inputSchema && tool.inputSchema.properties) {
        console.log(`   Input parameters:`, Object.keys(tool.inputSchema.properties));
      } else {
        console.log(`   Input parameters: none`);
      }
    });

    console.log('\n🧪 Testing each potential tool...');

    // Test each tool systematically
    for (const tool of potentialTools) {
      console.log(`\n--- Testing: ${tool.name} ---`);
      
      try {
        let args = {};
        
        // Try different parameter combinations based on what the tool expects
        if (tool.inputSchema && tool.inputSchema.properties) {
          const props = tool.inputSchema.properties;
          
          // If it has runId parameter
          if (props.runId) {
            args.runId = runId;
            console.log(`   Trying with runId: ${runId}`);
          }
          // If it has id parameter
          else if (props.id) {
            args.id = runId;
            console.log(`   Trying with id: ${runId}`);
          }
          // If it has instanceId parameter
          else if (props.instanceId) {
            args.instanceId = runId;
            console.log(`   Trying with instanceId: ${runId}`);
          }
          // If it has workflowId parameter, try the workflow name
          else if (props.workflowId) {
            args.workflowId = 'PROCESS_BLOG_POST';
            console.log(`   Trying with workflowId: PROCESS_BLOG_POST`);
          }
          // If it requires no parameters
          else if (Object.keys(props).length === 0) {
            console.log(`   Trying with no parameters`);
          }
          // Skip tools that require parameters we don't have
          else {
            console.log(`   Skipping - requires parameters: ${Object.keys(props).join(', ')}`);
            continue;
          }
        } else {
          console.log(`   Trying with no parameters`);
        }

        const result = await client.callTool({
          name: tool.name,
          arguments: args
        });

        console.log(`✅ Success! Result from ${tool.name}:`);
        console.log(JSON.stringify(result.structuredContent, null, 2));
        
        // If we found useful information, highlight it
        if (result.structuredContent && (
          JSON.stringify(result.structuredContent).includes(runId) ||
          JSON.stringify(result.structuredContent).includes('error') ||
          JSON.stringify(result.structuredContent).includes('status') ||
          JSON.stringify(result.structuredContent).includes('log')
        )) {
          console.log('🎯 This looks promising - contains relevant information!');
        }

      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }

    // Also try the DECO_CHAT tools specifically
    console.log('\n🎯 Trying DECO_CHAT specific approaches...');
    
    // Try to list views to see if there's a workflow view
    try {
      const viewsResult = await client.callTool({
        name: 'DECO_CHAT_VIEWS_LIST',
        arguments: {}
      });
      console.log('Available views:', JSON.stringify(viewsResult.structuredContent, null, 2));
    } catch (error) {
      console.log('Views list error:', error.message);
    }

    // Try OAuth to see if we need authentication
    try {
      const oauthResult = await client.callTool({
        name: 'DECO_CHAT_OAUTH_START',
        arguments: { returnUrl: 'http://localhost:49799' }
      });
      console.log('OAuth result:', JSON.stringify(oauthResult.structuredContent, null, 2));
    } catch (error) {
      console.log('OAuth error:', error.message);
    }

  } catch (error) {
    console.error('❌ Error debugging workflow run:', error.message);
  } finally {
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }
}

debugWorkflowRun().catch(console.error);