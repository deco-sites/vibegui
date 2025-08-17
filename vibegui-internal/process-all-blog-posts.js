/**
 * Process All Blog Posts using the MCP PROCESS_BLOG_POST workflow
 * This script processes all 51 existing blog posts through the working MCP system
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { prepareBlogPostsForMigration } from '../scripts/prepare_blog_migration.js';
import fs from 'fs';
import path from 'path';

const RESULTS_FILE = 'blog-processing-results.json';
const BATCH_SIZE = 5; // Process 5 posts at a time to avoid overwhelming the server
const DELAY_BETWEEN_BATCHES = 2000; // 2 second delay between batches

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processAllBlogPosts() {
  console.log('🚀 Processing All Blog Posts via MCP');
  console.log('=====================================');
  console.log(`Target: http://localhost:51305/mcp`);
  console.log(`Batch size: ${BATCH_SIZE} posts`);
  console.log(`Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`);
  console.log('');

  // Initialize MCP client
  const client = new Client({
    name: 'blog-migration-client',
    version: '1.0.0'
  });

  let results = {
    startTime: new Date().toISOString(),
    totalPosts: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    results: [],
    errors: []
  };

  try {
    // Connect to MCP server
    const transport = new StreamableHTTPClientTransport(new URL('http://localhost:51305/mcp'));
    await client.connect(transport);
    console.log('✅ Connected to MCP server');

    // Load blog posts data
    console.log('📖 Loading blog posts data...');
    let blogPosts;
    
    // Try to load from existing file first
    const migrationFile = '../scripts/blog_posts_for_migration.json';
    if (fs.existsSync(migrationFile)) {
      const data = fs.readFileSync(migrationFile, 'utf8');
      blogPosts = JSON.parse(data);
      console.log(`✅ Loaded ${blogPosts.length} posts from ${migrationFile}`);
    } else {
      // Generate fresh migration data
      console.log('Generating fresh migration data...');
      blogPosts = prepareBlogPostsForMigration();
      console.log(`✅ Generated ${blogPosts.length} posts for migration`);
    }

    results.totalPosts = blogPosts.length;

    // Filter posts that need processing (missing title or excerpt)
    const postsNeedingGeneration = blogPosts.filter(post => 
      !post.title || !post.excerpt || 
      post.title.trim() === '' || post.excerpt.trim() === ''
    );
    
    const postsWithMetadata = blogPosts.filter(post => 
      post.title && post.excerpt && 
      post.title.trim() !== '' && post.excerpt.trim() !== ''
    );

    console.log(`📊 Processing Summary:`);
    console.log(`   Total posts: ${blogPosts.length}`);
    console.log(`   Need title/excerpt generation: ${postsNeedingGeneration.length}`);
    console.log(`   Already have metadata: ${postsWithMetadata.length}`);
    console.log('');

    // Process all posts (both those needing generation and those with existing metadata)
    console.log('🔄 Starting batch processing...');

    for (let i = 0; i < blogPosts.length; i += BATCH_SIZE) {
      const batch = blogPosts.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(blogPosts.length / BATCH_SIZE);

      console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (posts ${i + 1}-${Math.min(i + BATCH_SIZE, blogPosts.length)})`);

      // Process batch in parallel
      const batchPromises = batch.map(async (post, batchIndex) => {
        const postNumber = i + batchIndex + 1;
        const needsGeneration = !post.title || !post.excerpt || 
                               post.title.trim() === '' || post.excerpt.trim() === '';
        
        console.log(`   ${postNumber}. Processing "${post.slug}" ${needsGeneration ? '(needs generation)' : '(has metadata)'}`);

        try {
          const workflowResult = await client.callTool({
            name: 'DECO_CHAT_WORKFLOWS_START_PROCESS_BLOG_POST',
            arguments: {
              id: post.id,
              slug: post.slug,
              content: post.content.substring(0, 1000), // Limit content for faster processing
              title: post.title || '',
              excerpt: post.excerpt || '',
              authorName: post.authorName || 'Unknown',
              authorEmail: post.authorEmail || '',
              publishedDate: post.publishedDate || '',
              interactionCount: post.interactionCount || 0
            }
          });

          results.processed++;
          results.successful++;

          const result = {
            postNumber,
            postId: post.id,
            slug: post.slug,
            needsGeneration,
            status: 'success',
            workflowRunId: workflowResult.structuredContent?.id,
            processedAt: new Date().toISOString()
          };

          results.results.push(result);
          console.log(`      ✅ Success - Run ID: ${result.workflowRunId}`);

          return result;

        } catch (error) {
          results.processed++;
          results.failed++;

          const result = {
            postNumber,
            postId: post.id,
            slug: post.slug,
            needsGeneration,
            status: 'error',
            error: error.message,
            processedAt: new Date().toISOString()
          };

          results.results.push(result);
          results.errors.push(result);
          console.log(`      ❌ Failed: ${error.message}`);

          return result;
        }
      });

      // Wait for batch to complete
      await Promise.all(batchPromises);

      // Progress update
      const progress = Math.round((results.processed / results.totalPosts) * 100);
      console.log(`   📈 Progress: ${results.processed}/${results.totalPosts} (${progress}%) - Success: ${results.successful}, Failed: ${results.failed}`);

      // Delay between batches (except for the last batch)
      if (i + BATCH_SIZE < blogPosts.length) {
        console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    results.endTime = new Date().toISOString();
    results.duration = new Date(results.endTime) - new Date(results.startTime);

    console.log('\n🎉 Processing Complete!');
    console.log('=======================');
    console.log(`✅ Successfully processed: ${results.successful}/${results.totalPosts}`);
    console.log(`❌ Failed: ${results.failed}/${results.totalPosts}`);
    console.log(`⏱️ Total time: ${Math.round(results.duration / 1000)}s`);

    // Save detailed results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`📄 Detailed results saved to: ${RESULTS_FILE}`);

    if (results.failed > 0) {
      console.log('\n❌ Failed Posts:');
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.slug}: ${error.error}`);
      });
    }

    // Summary of what was processed
    const generationPosts = results.results.filter(r => r.needsGeneration && r.status === 'success').length;
    const existingPosts = results.results.filter(r => !r.needsGeneration && r.status === 'success').length;
    
    console.log('\n📊 Final Summary:');
    console.log(`   Posts that needed title/excerpt generation: ${generationPosts}`);
    console.log(`   Posts that already had metadata: ${existingPosts}`);
    console.log('   All posts should now be available in your D1 database!');

  } catch (error) {
    console.error('❌ Fatal error during processing:', error.message);
    results.fatalError = error.message;
    results.endTime = new Date().toISOString();
    
    // Save partial results even on fatal error
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`📄 Partial results saved to: ${RESULTS_FILE}`);
  } finally {
    // Clean up MCP connection
    try {
      await client.close();
      console.log('✅ MCP client closed');
    } catch (closeError) {
      console.log('⚠️ Error closing MCP client:', closeError.message);
    }
  }

  return results;
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processAllBlogPosts().catch(console.error);
}

export { processAllBlogPosts };