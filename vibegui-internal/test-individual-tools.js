/**
 * Test Individual Tools Step by Step
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testIndividualTools() {
  console.log('🔧 Testing Individual Tools Step by Step');
  console.log('========================================');
  console.log('Target: http://localhost:64835/mcp');
  console.log('');

  const client = new Client({
    name: 'individual-tools-test',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:64835/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    const testContent = 'Este é um teste completo dos tools individuais. O sistema deve detectar que é português e gerar título e resumo.';

    // Step 1: Test DETECT_LANGUAGE
    console.log('\n🔍 Step 1: Testing DETECT_LANGUAGE');
    const languageResult = await client.callTool({
      name: 'DETECT_LANGUAGE',
      arguments: { content: testContent }
    });
    
    const detectedLang = languageResult.structuredContent;
    console.log('✅ Language detection result:', detectedLang);

    // Step 2: Test GENERATE_TITLE_EXCERPT
    console.log('\n📝 Step 2: Testing GENERATE_TITLE_EXCERPT');
    const generateResult = await client.callTool({
      name: 'GENERATE_TITLE_EXCERPT',
      arguments: {
        content: testContent,
        detectedLanguage: detectedLang.language,
        existingTitle: '',
        existingExcerpt: ''
      }
    });
    
    const generated = generateResult.structuredContent;
    console.log('✅ Title/excerpt generation result:', generated);

    // Step 3: Test INSERT_BLOG_POST
    console.log('\n💾 Step 3: Testing INSERT_BLOG_POST');
    const insertData = {
      id: 'individual-tools-test-789',
      originalSlug: 'individual-tools-test-789',
      content: testContent,
      originalLanguage: detectedLang.language,
      title: generated.title,
      excerpt: generated.excerpt,
      authorName: 'Individual Tools Test',
      authorEmail: 'test@example.com',
      publishedDate: '2024-12-17',
      interactionCount: 1
    };

    console.log('Insert data:', insertData);

    const insertResult = await client.callTool({
      name: 'INSERT_BLOG_POST',
      arguments: insertData
    });
    
    console.log('✅ Insert result:', insertResult.structuredContent);

    // Step 4: Verify the post was saved
    console.log('\n🔍 Step 4: Verifying post was saved');
    const verifyResult = await client.callTool({
      name: 'GET_BLOG_POST_WITH_TRANSLATION',
      arguments: {
        postId: insertData.id,
        languageCode: detectedLang.language
      }
    });

    if (verifyResult.structuredContent && verifyResult.structuredContent.post) {
      const savedPost = verifyResult.structuredContent.post;
      console.log('✅ SUCCESS! Post verified in database:');
      console.log(`   Title: "${savedPost.title}"`);
      console.log(`   Excerpt: "${savedPost.excerpt}"`);
      console.log(`   Language: ${savedPost.language}`);
      console.log('');
      console.log('🎉 All individual tools work correctly!');
      console.log('The issue must be in the workflow data mapping.');
    } else {
      console.log('❌ Post not found after insertion');
      console.log('Verification result:', verifyResult.structuredContent);
    }

  } catch (error) {
    console.error('❌ Error in individual tools test:', error.message);
    console.error('Full error:', error);
  } finally {
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }
}

testIndividualTools().catch(console.error);