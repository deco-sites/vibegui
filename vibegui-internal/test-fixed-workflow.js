/**
 * Test the Fixed Workflow on new port
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testFixedWorkflow() {
  console.log('🧪 Testing Fixed Workflow');
  console.log('========================');
  console.log('Target: http://localhost:49895/mcp');
  console.log('');

  const client = new Client({
    name: 'workflow-test-client',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:49895/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Test with a sample blog post that needs generation
    const testPost = {
      id: 'workflow-test-fixed-final-000',
      slug: 'workflow-test-fixed-final-000',
      content: 'Este é um teste do workflow corrigido. O sistema deve detectar que é português, gerar título e resumo automaticamente, e salvar tudo no banco de dados D1.',
      title: '', // Empty to trigger generation
      excerpt: '', // Empty to trigger generation
      authorName: 'Workflow Test',
      authorEmail: 'test@example.com',
      publishedDate: '2024-12-17',
      interactionCount: 1
    };

    console.log('📄 Test Post Data:');
    console.log(`   ID: ${testPost.id}`);
    console.log(`   Content: ${testPost.content.substring(0, 50)}...`);
    console.log(`   Needs Generation: ${!testPost.title || !testPost.excerpt}`);
    console.log('');

    console.log('🚀 Starting PROCESS_BLOG_POST workflow...');
    const workflowResult = await client.callTool({
      name: 'DECO_CHAT_WORKFLOWS_START_PROCESS_BLOG_POST',
      arguments: testPost
    });

    console.log('✅ Workflow started successfully!');
    console.log('Run ID:', workflowResult.structuredContent?.id);
    console.log('');

    // Wait a moment for the workflow to complete
    console.log('⏳ Waiting 5 seconds for workflow to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if the post was saved to database
    console.log('🔍 Checking if post was saved to database...');
    try {
      const postResult = await client.callTool({
        name: 'GET_BLOG_POST_WITH_TRANSLATION',
        arguments: {
          postId: testPost.id,
          languageCode: 'pt'
        }
      });

      if (postResult.structuredContent && postResult.structuredContent.post) {
        const savedPost = postResult.structuredContent.post;
        console.log('✅ SUCCESS! Post found in database:');
        console.log(`   Title: "${savedPost.title}"`);
        console.log(`   Language: ${savedPost.language}`);
        console.log(`   Excerpt: "${savedPost.excerpt}"`);
        console.log(`   Is Translated: ${savedPost.isTranslated}`);
        console.log('');
        console.log('🎉 Workflow is now working correctly!');
      } else {
        console.log('❌ Post not found in database');
        console.log('Raw response:', JSON.stringify(postResult.structuredContent, null, 2));
      }
    } catch (checkError) {
      console.log('❌ Error checking post in database:', checkError.message);
    }

    // Also check the overall database content
    console.log('');
    console.log('📊 Checking total database content:');
    try {
      const listResult = await client.callTool({
        name: 'LIST_BLOG_POSTS',
        arguments: { limit: 20 }
      });

      if (listResult.structuredContent && listResult.structuredContent.posts) {
        const posts = listResult.structuredContent.posts;
        console.log(`✅ Total posts in database: ${posts.length}`);
        
        if (posts.length > 0) {
          console.log('Recent posts:');
          posts.slice(0, 5).forEach((post, index) => {
            console.log(`   ${index + 1}. ${post.id} - "${post.title || 'No title'}" (${post.originalLanguage || 'unknown'})`);
          });
        }
      }
    } catch (listError) {
      console.log('❌ Error listing posts:', listError.message);
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

testFixedWorkflow().catch(console.error);