/**
 * List all blog posts from the database
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function listAllPosts() {
  console.log('📋 Listing All Blog Posts from Database');
  console.log('======================================');

  const client = new Client({
    name: 'post-lister',
    version: '1.0.0'
  });

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:49895/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Get all posts
    const result = await client.callTool({
      name: 'LIST_BLOG_POSTS',
      arguments: { limit: 100 } // Get up to 100 posts
    });

    if (result.structuredContent && result.structuredContent.posts) {
      const posts = result.structuredContent.posts;
      console.log(`\n📊 Found ${posts.length} posts in database:`);
      console.log('');

      // Group by language
      const byLanguage = {};
      posts.forEach(post => {
        const lang = post.originalLanguage || 'unknown';
        if (!byLanguage[lang]) byLanguage[lang] = [];
        byLanguage[lang].push(post);
      });

      console.log('📈 Summary by language:');
      Object.entries(byLanguage).forEach(([lang, langPosts]) => {
        console.log(`   ${lang}: ${langPosts.length} posts`);
      });
      console.log('');

      // List all posts
      console.log('📝 All posts:');
      console.log('=============');
      posts.forEach((post, index) => {
        const title = post.title || 'No title';
        const excerpt = post.excerpt || 'No excerpt';
        const lang = post.originalLanguage || 'unknown';
        const author = post.authorName || 'Unknown';
        
        console.log(`${index + 1}. ${post.id}`);
        console.log(`   Title: "${title}"`);
        console.log(`   Language: ${lang}`);
        console.log(`   Author: ${author}`);
        console.log(`   Excerpt: "${excerpt.substring(0, 100)}${excerpt.length > 100 ? '...' : ''}"`);
        console.log(`   Created: ${post.createdAt || 'unknown'}`);
        console.log('');
      });

    } else {
      console.log('❌ No posts found or unexpected response format');
      console.log('Response:', JSON.stringify(result.structuredContent, null, 2));
    }

  } catch (error) {
    console.error('❌ Error listing posts:', error.message);
  } finally {
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }
}

listAllPosts().catch(console.error);