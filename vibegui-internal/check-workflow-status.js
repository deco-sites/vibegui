/**
 * Check status of the latest workflow run
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function checkWorkflowStatus() {
  console.log('🔍 Checking Workflow Status');
  console.log('===========================');
  
  const runId = '75d2935e-0f13-4b86-b40c-f98b33119113';
  const workflowName = 'PROCESS_BLOG_POST';

  const client = new Client({
    name: 'workflow-status-checker',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:49895/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Get workflow status
    console.log(`\n🎯 Getting status for workflow ${runId}...`);
    const statusResult = await client.callTool({
      name: 'WORKFLOW_STATUS',
      arguments: {
        instanceId: runId,
        workflowName: workflowName
      }
    });
    
    console.log('✅ Workflow Status Result:');
    
    if (statusResult.structuredContent && statusResult.structuredContent.snapshot) {
      const snapshot = statusResult.structuredContent.snapshot;
      console.log(`Status: ${snapshot.status}`);
      
      if (snapshot.error) {
        console.log('\n❌ ERROR DETAILS:');
        console.log(snapshot.error);
      }
      
      if (snapshot.context) {
        console.log('\n📊 STEP EXECUTION DETAILS:');
        console.log('==========================');
        
        for (const [stepName, stepDetails] of Object.entries(snapshot.context)) {
          if (stepName === 'input') continue;
          
          console.log(`\n🔹 Step: ${stepName}`);
          console.log(`   Status: ${stepDetails.status || 'unknown'}`);
          
          if (stepDetails.error) {
            console.log(`   ❌ Error: ${stepDetails.error}`);
          }
          
          if (stepDetails.output) {
            console.log(`   ✅ Output:`);
            console.log(`      ${JSON.stringify(stepDetails.output, null, 6)}`);
          }
        }
      }
    } else {
      console.log('Full response:', JSON.stringify(statusResult.structuredContent, null, 2));
    }

  } catch (error) {
    console.error('❌ Error checking workflow status:', error.message);
  } finally {
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }
}

checkWorkflowStatus().catch(console.error);