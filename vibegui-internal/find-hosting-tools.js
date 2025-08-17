/**
 * Find Hosting & Deployment MCP Tools
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function findHostingTools() {
  console.log('🔍 Finding Hosting & Deployment MCP Tools');
  console.log('==========================================');
  console.log('');

  const client = new Client({
    name: 'hosting-tools-finder',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:49895/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Get ALL tools
    const tools = await client.listTools();
    console.log(`📋 Total tools available: ${tools.tools.length}`);
    console.log('');

    // Show ALL tools to see what we're missing
    console.log('🔧 ALL AVAILABLE TOOLS:');
    console.log('========================');
    tools.tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      if (tool.inputSchema && tool.inputSchema.properties) {
        const params = Object.keys(tool.inputSchema.properties);
        console.log(`   Parameters: ${params.join(', ')}`);
      } else {
        console.log(`   Parameters: none`);
      }
      console.log('');
    });

    // Look specifically for hosting/deployment/workflow status tools
    console.log('🎯 LOOKING FOR HOSTING/WORKFLOW TOOLS:');
    console.log('======================================');
    
    const hostingTools = tools.tools.filter(tool => {
      const name = tool.name.toLowerCase();
      const desc = tool.description.toLowerCase();
      return (
        name.includes('hosting') ||
        name.includes('deployment') ||
        name.includes('app') ||
        name.includes('status') ||
        name.includes('runs') ||
        name.includes('list') ||
        desc.includes('hosting') ||
        desc.includes('deployment') ||
        desc.includes('app') ||
        desc.includes('status') ||
        desc.includes('runs') ||
        desc.includes('workflow')
      );
    });

    if (hostingTools.length > 0) {
      console.log(`Found ${hostingTools.length} hosting/workflow related tools:`);
      hostingTools.forEach((tool, index) => {
        console.log(`\n${index + 1}. ${tool.name}`);
        console.log(`   Description: ${tool.description}`);
        if (tool.inputSchema && tool.inputSchema.properties) {
          console.log(`   Parameters:`, Object.keys(tool.inputSchema.properties));
          console.log(`   Full schema:`, JSON.stringify(tool.inputSchema, null, 2));
        }
      });
      
      // Try to call the hosting tools
      console.log('\n🧪 Testing hosting tools...');
      for (const tool of hostingTools) {
        try {
          console.log(`\n--- Testing: ${tool.name} ---`);
          
          let args = {};
          
          // Try different approaches based on tool parameters
          if (tool.inputSchema && tool.inputSchema.properties) {
            const props = Object.keys(tool.inputSchema.properties);
            console.log(`   Required parameters: ${props.join(', ')}`);
            
            // If no required parameters, try empty call
            if (props.length === 0) {
              console.log('   Calling with no parameters...');
            } else {
              console.log('   Skipping - requires parameters');
              continue;
            }
          } else {
            console.log('   Calling with no parameters...');
          }

          const result = await client.callTool({
            name: tool.name,
            arguments: args
          });

          console.log(`✅ Success! Result:`);
          console.log(JSON.stringify(result.structuredContent, null, 2));

        } catch (error) {
          console.log(`❌ Error: ${error.message}`);
        }
      }
    } else {
      console.log('❌ No hosting/workflow tools found');
      console.log('');
      console.log('This suggests the Hosting & Deployment MCP might not be connected,');
      console.log('or we might need different authentication/configuration.');
    }

  } catch (error) {
    console.error('❌ Error finding hosting tools:', error.message);
  } finally {
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }
}

findHostingTools().catch(console.error);