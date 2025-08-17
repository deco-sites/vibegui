/**
 * Test the fixed PROCESS_BLOG_POST workflow
 */
const http = require('http');

function makeRequest(path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 51305,
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

async function testWorkflow() {
  console.log('🔄 Testing PROCESS_BLOG_POST Workflow');
  console.log('====================================');

  const testPost = {
    id: "workflow-test-789",
    slug: "workflow-test-789",
    content: "Este é um teste completo do workflow. O sistema deve detectar que é português, gerar um título atrativo e um resumo informativo, e depois salvar tudo no banco de dados.",
    title: "",
    excerpt: "",
    authorName: "Workflow Tester",
    authorEmail: "test@example.com",
    publishedDate: "2024-12-17",
    interactionCount: 5
  };

  console.log('Input data:', JSON.stringify(testPost, null, 2));
  console.log('');

  try {
    console.log('Calling workflow...');
    const result = await makeRequest('/mcp/start-workflow/PROCESS_BLOG_POST', testPost);
    
    console.log(`Status: ${result.status}`);
    
    if (result.status === 200) {
      console.log('✅ Workflow executed successfully!');
      console.log('Result:', JSON.stringify(result.data, null, 2));
      
      // Check if post was actually saved
      console.log('');
      console.log('Verifying post was saved...');
      const listResult = await makeRequest('/mcp/call-tool/LIST_BLOG_POSTS', { limit: 10 });
      
      if (listResult.status === 200) {
        const savedPost = listResult.data.posts.find(p => p.id === testPost.id);
        if (savedPost) {
          console.log('✅ Post found in database:');
          console.log(`   Title: "${savedPost.title}"`);
          console.log(`   Language: ${savedPost.originalLanguage}`);
          console.log(`   Excerpt: "${savedPost.excerpt}"`);
        } else {
          console.log('❌ Post not found in database');
        }
      }
      
    } else {
      console.log('❌ Workflow failed:');
      console.log(result.data);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWorkflow();