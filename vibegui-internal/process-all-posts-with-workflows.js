/**
 * Process all 51 blog posts using the now-working workflows
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'fs';
import path from 'path';

async function processAllBlogPosts() {
  console.log('🚀 Processing All 51 Blog Posts with Workflows');
  console.log('==============================================');
  console.log('Target: http://localhost:49895/mcp');
  console.log('');

  const client = new Client({
    name: 'bulk-blog-processor',
    version: '1.0.0'
  });

  let successCount = 0;
  let errorCount = 0;
  const results = [];

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:49895/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Read all blog posts from the migration file
    const blogPostsFile = '../scripts/blog_posts_for_migration.json';
    if (!fs.existsSync(blogPostsFile)) {
      throw new Error('Blog posts migration file not found');
    }
    
    const posts = JSON.parse(fs.readFileSync(blogPostsFile, 'utf8'));
    console.log(`📄 Found ${posts.length} blog posts for migration`);
    console.log('');

    // Process each blog post
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      
      console.log(`📝 Processing ${i + 1}/${posts.length}: ${post.slug || post.id}`);
      
      try {
        // Skip if this is not a blog post or missing essential data
        if (!post || !post.content || typeof post.content !== 'string') {
          console.log(`   ⚠️  Skipping - invalid post structure`);
          continue;
        }

        // Prepare the post data for the workflow
        const postData = {
          id: post.slug || post.id || `post-${i}`,
          slug: post.slug || post.id || `post-${i}`,
          content: post.content,
          title: post.title || '',
          excerpt: post.excerpt || '',
          authorName: post.authorName || post.author || 'Unknown Author',
          authorEmail: post.authorEmail || post.email || '',
          publishedDate: post.publishedDate || post.date || new Date().toISOString().split('T')[0],
          interactionCount: parseInt(post.interactionCount) || 0
        };

        console.log(`   📊 Data: "${(post.title || 'No title').substring(0, 50)}..." (${post.content.length} chars)`);

        // Run the PROCESS_BLOG_POST workflow
        const workflowResult = await client.callTool({
          name: 'DECO_CHAT_WORKFLOWS_START_PROCESS_BLOG_POST',
          arguments: postData
        });

        console.log(`   ✅ Workflow started: ${workflowResult.structuredContent?.id}`);
        
        results.push({
          index: i,
          postId: postData.id,
          slug: postData.slug,
          originalTitle: post.title || 'No title',
          workflowRunId: workflowResult.structuredContent?.id,
          status: 'started',
          timestamp: new Date().toISOString()
        });
        
        successCount++;

        // Small delay between requests to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log(`   ❌ Error processing ${post.slug}: ${error.message}`);
        errorCount++;
        
        results.push({
          index: i,
          slug: post.slug,
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    console.log('\n📊 Processing Summary:');
    console.log(`✅ Started successfully: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📁 Total posts: ${posts.length}`);

    // Save results to file
    const resultsFile = 'workflow-processing-results.json';
    fs.writeFileSync(resultsFile, JSON.stringify({
      summary: {
        total: posts.length,
        success: successCount,
        errors: errorCount,
        timestamp: new Date().toISOString()
      },
      results: results
    }, null, 2));
    
    console.log(`💾 Results saved to ${resultsFile}`);

    // Wait a bit for workflows to complete, then check database
    console.log('\n⏳ Waiting 30 seconds for workflows to complete...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Check final database state
    console.log('\n📊 Checking final database state:');
    try {
      const listResult = await client.callTool({
        name: 'LIST_BLOG_POSTS',
        arguments: { limit: 100 }
      });

      if (listResult.structuredContent && listResult.structuredContent.posts) {
        const posts = listResult.structuredContent.posts;
        console.log(`✅ Total posts in database: ${posts.length}`);
        
        // Count by language
        const languageCount = {};
        posts.forEach(post => {
          const lang = post.originalLanguage || 'unknown';
          languageCount[lang] = (languageCount[lang] || 0) + 1;
        });
        
        console.log('📈 Posts by language:');
        Object.entries(languageCount).forEach(([lang, count]) => {
          console.log(`   ${lang}: ${count} posts`);
        });

        // Show recent posts
        console.log('\n📝 Recent posts (last 10):');
        posts.slice(-10).forEach((post, index) => {
          console.log(`   ${index + 1}. ${post.id} - "${(post.title || 'No title').substring(0, 60)}..." (${post.originalLanguage || 'unknown'})`);
        });
      }
    } catch (dbError) {
      console.log('❌ Error checking final database state:', dbError.message);
    }

    console.log('\n🎉 All blog posts processing initiated!');
    console.log('Check the database and workflow results for final status.');

  } catch (error) {
    console.error('❌ Fatal error during processing:', error.message);
  } finally {
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }
}

processAllBlogPosts().catch(console.error);