/**
 * Debug the specific workflow run b2ece137-0641-4ab7-9091-7c408022f011
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function debugSpecificWorkflow() {
  console.log('🔍 Debug Workflow b2ece137-0641-4ab7-9091-7c408022f011');
  console.log('=====================================================');
  
  const runId = 'b2ece137-0641-4ab7-9091-7c408022f011';
  const workflowName = 'PROCESS_BLOG_POST';

  const client = new Client({
    name: 'workflow-specific-debugger',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:49895/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // 1. Get workflow status using our new native tool
    console.log('\n🎯 Step 1: Get workflow status');
    try {
      const statusResult = await client.callTool({
        name: 'WORKFLOW_STATUS',
        arguments: {
          instanceId: runId,
          workflowName: workflowName
        }
      });
      
      console.log('✅ Workflow Status Result:');
      console.log(JSON.stringify(statusResult.structuredContent, null, 2));
    } catch (statusError) {
      console.log('❌ Status error:', statusError.message);
    }

    // 2. List workflow runs to see recent ones
    console.log('\n🎯 Step 2: List recent workflow runs');
    try {
      const runsResult = await client.callTool({
        name: 'LIST_WORKFLOW_RUNS',
        arguments: {
          workflowName: workflowName,
          page: 1,
          per_page: 10
        }
      });
      
      console.log('✅ Recent Workflow Runs:');
      console.log(JSON.stringify(runsResult.structuredContent, null, 2));
      
      // Look for our specific run ID
      if (runsResult.structuredContent && runsResult.structuredContent.runs) {
        const ourRun = runsResult.structuredContent.runs.find(run => 
          run.id === runId || run.instanceId === runId || 
          JSON.stringify(run).includes(runId)
        );
        
        if (ourRun) {
          console.log('\n🎯 Found our specific run:');
          console.log(JSON.stringify(ourRun, null, 2));
        } else {
          console.log('\n❌ Our specific run not found in recent runs');
          console.log('Available run IDs:');
          runsResult.structuredContent.runs.forEach((run, index) => {
            console.log(`   ${index + 1}. ${run.id || run.instanceId || 'unknown-id'} - ${run.status || 'unknown-status'}`);
          });
        }
      }
    } catch (runsError) {
      console.log('❌ Runs error:', runsError.message);
    }

    // 3. List all workflow runs (no filter) to see everything
    console.log('\n🎯 Step 3: List ALL workflow runs');
    try {
      const allRunsResult = await client.callTool({
        name: 'LIST_WORKFLOW_RUNS',
        arguments: {
          page: 1,
          per_page: 20
        }
      });
      
      console.log('✅ All Recent Runs (any workflow):');
      if (allRunsResult.structuredContent && allRunsResult.structuredContent.runs) {
        console.log(`Found ${allRunsResult.structuredContent.runs.length} runs:`);
        allRunsResult.structuredContent.runs.forEach((run, index) => {
          const runInfo = {
            index: index + 1,
            id: run.id || run.instanceId || 'unknown-id',
            workflow: run.workflowName || run.workflow || 'unknown-workflow',
            status: run.status || 'unknown-status',
            createdAt: run.createdAt || run.created_at || 'unknown-time',
            error: run.error || run.errorMessage || null
          };
          console.log(JSON.stringify(runInfo, null, 2));
          
          // Check if this might be our run
          if (runInfo.id.includes(runId.substring(0, 8))) {
            console.log('   ^^^ This might be our target run! ^^^');
          }
        });
      }
      
      console.log('\nFull response structure:');
      console.log(JSON.stringify(allRunsResult.structuredContent, null, 2));
    } catch (allRunsError) {
      console.log('❌ All runs error:', allRunsError.message);
    }

  } catch (error) {
    console.error('❌ Error debugging specific workflow:', error.message);
  } finally {
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }
}

debugSpecificWorkflow().catch(console.error);