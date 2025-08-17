/**
 * Test Simple Workflow with longer wait time
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testSimpleWorkflow() {
  console.log('🧪 Testing Simple Workflow (Long Wait)');
  console.log('====================================');

  const client = new Client({
    name: 'simple-workflow-test',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:49799/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    const testPost = {
      id: 'simple-workflow-test-888',
      slug: 'simple-workflow-test-888',
      content: 'Este é um teste muito simples do workflow simplificado. Esperamos que funcione agora!',
      title: '',
      excerpt: '',
      authorName: 'Simple Test',
      publishedDate: '2024-12-17',
      interactionCount: 1
    };

    console.log(`🚀 Starting workflow for post: ${testPost.id}`);
    const workflowResult = await client.callTool({
      name: 'DECO_CHAT_WORKFLOWS_START_PROCESS_BLOG_POST',
      arguments: testPost
    });

    console.log('✅ Workflow started!');
    console.log('Run ID:', workflowResult.structuredContent?.id);

    // Wait longer for workflow to complete
    console.log('⏳ Waiting 15 seconds for workflow to complete...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check database multiple times
    for (let i = 1; i <= 3; i++) {
      console.log(`\n🔍 Check ${i}: Looking for post in database...`);
      
      const postResult = await client.callTool({
        name: 'GET_BLOG_POST_WITH_TRANSLATION',
        arguments: {
          postId: testPost.id,
          languageCode: 'pt'
        }
      });

      if (postResult.structuredContent && postResult.structuredContent.post) {
        const savedPost = postResult.structuredContent.post;
        console.log('🎉 SUCCESS! Post found:');
        console.log(`   Title: "${savedPost.title}"`);
        console.log(`   Excerpt: "${savedPost.excerpt}"`);
        console.log(`   Language: ${savedPost.language}`);
        return; // Success!
      } else {
        console.log(`   ❌ Attempt ${i}: Post not found yet`);
        if (i < 3) {
          console.log('   ⏳ Waiting 5 more seconds...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    console.log('\n❌ Post was never saved to database');
    
    // Check total database content
    console.log('\n📊 Current database content:');
    const listResult = await client.callTool({
      name: 'LIST_BLOG_POSTS',
      arguments: { limit: 10 }
    });

    if (listResult.structuredContent && listResult.structuredContent.posts) {
      const posts = listResult.structuredContent.posts;
      console.log(`Total posts: ${posts.length}`);
      posts.forEach((post, index) => {
        console.log(`   ${index + 1}. ${post.id} - "${post.title}" (${post.originalLanguage})`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }
}

testSimpleWorkflow().catch(console.error);