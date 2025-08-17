/**
 * Comprehensive MCP test suite
 */
const http = require('http');

const MCP_URL = 'http://localhost:56791';

function makeRequest(path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 56791,
      path: path,
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runFullMCPTest() {
  console.log('🧪 Comprehensive MCP Blog System Test');
  console.log('=====================================');
  console.log(`Server: ${MCP_URL}`);
  console.log('');

  const testData = {
    portuguesePost: {
      content: "Todo dia eu durmo feliz por saber que a minha empresa não vende vício, jogo e aposta pra pagar as contas. Boa noite!",
      detectedLanguage: "pt"
    },
    englishPost: {
      content: "The web is the most important computing platform of our time. It's open, accessible, and constantly evolving.",
      detectedLanguage: "en"
    }
  };

  try {
    console.log('🔍 Test 1: Language Detection (Portuguese)');
    const ptDetection = await makeRequest('/mcp/call-tool/DETECT_LANGUAGE', {
      content: testData.portuguesePost.content
    });
    console.log(`Status: ${ptDetection.status}`);
    if (ptDetection.status === 200) {
      console.log(`✅ Detected: ${ptDetection.data.language} (confidence: ${ptDetection.data.confidence})`);
    } else {
      console.log(`❌ Failed:`, ptDetection.data);
    }
    console.log('');

    console.log('🔍 Test 2: Language Detection (English)');
    const enDetection = await makeRequest('/mcp/call-tool/DETECT_LANGUAGE', {
      content: testData.englishPost.content
    });
    console.log(`Status: ${enDetection.status}`);
    if (enDetection.status === 200) {
      console.log(`✅ Detected: ${enDetection.data.language} (confidence: ${enDetection.data.confidence})`);
    } else {
      console.log(`❌ Failed:`, enDetection.data);
    }
    console.log('');

    console.log('📝 Test 3: Title/Excerpt Generation (Portuguese)');
    const ptGeneration = await makeRequest('/mcp/call-tool/GENERATE_TITLE_EXCERPT', {
      content: testData.portuguesePost.content,
      detectedLanguage: "pt"
    });
    console.log(`Status: ${ptGeneration.status}`);
    if (ptGeneration.status === 200) {
      console.log(`✅ Generated title: "${ptGeneration.data.title}"`);
      console.log(`✅ Generated excerpt: "${ptGeneration.data.excerpt}"`);
    } else {
      console.log(`❌ Failed:`, ptGeneration.data);
    }
    console.log('');

    console.log('📝 Test 4: Title/Excerpt Generation (English)');
    const enGeneration = await makeRequest('/mcp/call-tool/GENERATE_TITLE_EXCERPT', {
      content: testData.englishPost.content,
      detectedLanguage: "en"
    });
    console.log(`Status: ${enGeneration.status}`);
    if (enGeneration.status === 200) {
      console.log(`✅ Generated title: "${enGeneration.data.title}"`);
      console.log(`✅ Generated excerpt: "${enGeneration.data.excerpt}"`);
    } else {
      console.log(`❌ Failed:`, enGeneration.data);
    }
    console.log('');

    console.log('💾 Test 5: Insert Blog Post');
    const insertPost = await makeRequest('/mcp/call-tool/INSERT_BLOG_POST', {
      id: "test-post-123",
      originalSlug: "test-post-123",
      content: testData.portuguesePost.content,
      originalLanguage: "pt",
      title: "Teste de Post",
      excerpt: "Este é um post de teste",
      authorName: "Test Author",
      publishedDate: "2024-12-17",
      interactionCount: 42
    });
    console.log(`Status: ${insertPost.status}`);
    if (insertPost.status === 200) {
      console.log(`✅ Post inserted: ${insertPost.data.postId}`);
      console.log(`✅ Metadata ID: ${insertPost.data.metadataId}`);
    } else {
      console.log(`❌ Failed:`, insertPost.data);
    }
    console.log('');

    console.log('📋 Test 6: List Blog Posts (After Insert)');
    const listPosts = await makeRequest('/mcp/call-tool/LIST_BLOG_POSTS', {
      limit: 10
    });
    console.log(`Status: ${listPosts.status}`);
    if (listPosts.status === 200) {
      console.log(`✅ Found ${listPosts.data.total} posts`);
      if (listPosts.data.posts.length > 0) {
        const post = listPosts.data.posts[0];
        console.log(`   - Post ID: ${post.id}`);
        console.log(`   - Title: ${post.title}`);
        console.log(`   - Language: ${post.originalLanguage}`);
      }
    } else {
      console.log(`❌ Failed:`, listPosts.data);
    }
    console.log('');

    console.log('🌐 Test 7: Check Translation');
    const checkTranslation = await makeRequest('/mcp/call-tool/CHECK_TRANSLATION', {
      postId: "test-post-123",
      languageCode: "en"
    });
    console.log(`Status: ${checkTranslation.status}`);
    if (checkTranslation.status === 200) {
      console.log(`✅ Translation check: ${checkTranslation.data.hasTranslation ? 'Found' : 'Not found'}`);
    } else {
      console.log(`❌ Failed:`, checkTranslation.data);
    }
    console.log('');

    console.log('🔄 Test 8: PROCESS_BLOG_POST Workflow');
    const processWorkflow = await makeRequest('/mcp/start-workflow/PROCESS_BLOG_POST', {
      id: "workflow-test-456",
      slug: "workflow-test-456",
      content: "Este é um teste do workflow completo. O sistema deve detectar português e gerar título e resumo automaticamente.",
      title: "",
      excerpt: "",
      authorName: "Workflow Tester",
      publishedDate: "2024-12-17",
      interactionCount: 1
    });
    console.log(`Status: ${processWorkflow.status}`);
    if (processWorkflow.status === 200) {
      console.log(`✅ Workflow started successfully`);
      console.log('Result:', processWorkflow.data);
    } else {
      console.log(`❌ Workflow failed:`, processWorkflow.data);
    }
    console.log('');

    console.log('🎉 MCP Test Suite Complete!');
    console.log('==============================');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

runFullMCPTest();