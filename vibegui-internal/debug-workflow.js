/**
 * Debug Workflow - Test each tool call individually in sequence
 * to replicate the workflow manually and see where it breaks
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function debugWorkflowManually() {
  console.log('🐛 Debugging Workflow Manually');
  console.log('==============================');
  console.log('Target: http://localhost:64835/mcp');
  console.log('');

  const client = new Client({
    name: 'workflow-debug-client',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:64835/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Original input (what we send to the workflow)
    const originalInput = {
      id: 'debug-workflow-test-999',
      slug: 'debug-workflow-test-999', 
      content: 'Este é um teste de debug do workflow. O sistema deve detectar português, gerar título e resumo, e salvar no banco.',
      title: '',
      excerpt: '',
      authorName: 'Debug Test',
      authorEmail: 'debug@test.com',
      publishedDate: '2024-12-17',
      interactionCount: 5
    };

    console.log('🎯 Original Input:');
    console.log(JSON.stringify(originalInput, null, 2));
    console.log('');

    // STEP 1: Detect Language (exactly like workflow step 1)
    console.log('📍 STEP 1: Detect Language');
    const languageResult = await client.callTool({
      name: 'DETECT_LANGUAGE',
      arguments: { content: originalInput.content }
    });
    
    const detectedLang = languageResult.structuredContent;
    console.log('Result:', detectedLang);
    console.log('');

    // STEP 2: Map data for generation (like workflow step 3)
    console.log('📍 STEP 2: Prepare data for title/excerpt generation');
    const preparedData = {
      content: originalInput.content,
      detectedLanguage: detectedLang.language,
      existingTitle: originalInput.title || "",
      existingExcerpt: originalInput.excerpt || "",
      // Keep original input data for later use
      originalId: originalInput.id,
      originalSlug: originalInput.slug,
      originalAuthorName: originalInput.authorName,
      originalAuthorEmail: originalInput.authorEmail,
      originalPublishedDate: originalInput.publishedDate,
      originalInteractionCount: originalInput.interactionCount,
    };

    console.log('Prepared Data:');
    console.log(JSON.stringify(preparedData, null, 2));
    console.log('');

    // STEP 3: Generate title/excerpt (like workflow step 4)
    console.log('📍 STEP 3: Generate Title/Excerpt');
    const generateResult = await client.callTool({
      name: 'GENERATE_TITLE_EXCERPT',
      arguments: {
        content: preparedData.content,
        detectedLanguage: preparedData.detectedLanguage,
        existingTitle: preparedData.existingTitle,
        existingExcerpt: preparedData.existingExcerpt
      }
    });

    const generated = generateResult.structuredContent;
    console.log('Generated Result:', generated);
    console.log('');

    // STEP 4: Process generation results (like workflow step 5)
    console.log('📍 STEP 4: Process generation results');
    const wasGenerated = (!preparedData.existingTitle || preparedData.existingTitle.trim() === "" || 
                         !preparedData.existingExcerpt || preparedData.existingExcerpt.trim() === "");

    const processedData = {
      id: preparedData.originalId,
      slug: preparedData.originalSlug,
      content: preparedData.content,
      originalLanguage: detectedLang.language,
      title: generated.title,
      excerpt: generated.excerpt,
      authorName: preparedData.originalAuthorName,
      authorEmail: preparedData.originalAuthorEmail,
      publishedDate: preparedData.originalPublishedDate,
      interactionCount: preparedData.originalInteractionCount || 0,
      wasGenerated,
      finalTitle: generated.title,
      finalExcerpt: generated.excerpt,
    };

    console.log('Processed Data:');
    console.log(JSON.stringify(processedData, null, 2));
    console.log('');

    // STEP 5: Prepare for database insert (like workflow step 6)
    console.log('📍 STEP 5: Prepare for database insert');
    const insertData = {
      id: processedData.id,
      originalSlug: processedData.slug,
      content: processedData.content,
      originalLanguage: processedData.originalLanguage,
      title: processedData.title,
      excerpt: processedData.excerpt,
      authorName: processedData.authorName,
      authorEmail: processedData.authorEmail,
      publishedDate: processedData.publishedDate,
      interactionCount: processedData.interactionCount || 0,
    };

    console.log('Insert Data:');
    console.log(JSON.stringify(insertData, null, 2));
    console.log('');

    // STEP 6: Insert into database
    console.log('📍 STEP 6: Insert into database');
    const insertResult = await client.callTool({
      name: 'INSERT_BLOG_POST',
      arguments: insertData
    });

    console.log('Insert Result:', insertResult.structuredContent);
    console.log('');

    // STEP 7: Verify it worked
    console.log('📍 STEP 7: Verify insertion');
    const verifyResult = await client.callTool({
      name: 'GET_BLOG_POST_WITH_TRANSLATION',
      arguments: {
        postId: insertData.id,
        languageCode: detectedLang.language
      }
    });

    if (verifyResult.structuredContent && verifyResult.structuredContent.post) {
      const savedPost = verifyResult.structuredContent.post;
      console.log('✅ SUCCESS! Manual workflow completed:');
      console.log(`   Title: "${savedPost.title}"`);
      console.log(`   Excerpt: "${savedPost.excerpt}"`);
      console.log(`   Language: ${savedPost.language}`);
      console.log('');
      console.log('🎉 The manual workflow works! The issue is in the workflow definition itself.');
    } else {
      console.log('❌ Manual workflow also failed');
      console.log('Verification result:', verifyResult.structuredContent);
    }

  } catch (error) {
    console.error('❌ Error in manual workflow debug:', error.message);
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

debugWorkflowManually().catch(console.error);