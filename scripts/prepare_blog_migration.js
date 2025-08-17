#!/usr/bin/env node

/**
 * This script reads all JSON blog post files from .deco/blocks/collections/blog/posts/
 * and prepares them for migration to the D1 database via the MCP workflow.
 * 
 * Run this script, then use the output JSON array with the PROCESS_BLOG_POST workflow
 * in your deco.chat interface.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The directory path uses URL encoding, so we need to construct it correctly
const BLOG_POSTS_DIR = path.join(__dirname, '../.deco/blocks');

function getBlogPostFiles() {
  const files = fs.readdirSync(BLOG_POSTS_DIR);
  return files.filter(file => 
    file.startsWith('collections%2Fblog%2Fposts%2F') && 
    file.endsWith('.json') &&
    !file.includes('deco-')
  );
}

function extractContentText(htmlContent) {
  // Simple HTML tag removal - in production you might want to use a proper HTML parser
  return htmlContent
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function prepareBlogPostsForMigration() {
  try {
    // Read all blog post JSON files
    const files = getBlogPostFiles().sort();

    console.log(`Found ${files.length} blog post files to process`);

    const blogPosts = [];

    for (const file of files) {
      try {
        const filePath = path.join(BLOG_POSTS_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const postData = JSON.parse(content);

        if (postData.post) {
          const post = postData.post;
          
          // Extract clean text content from HTML
          const cleanContent = extractContentText(post.content || '');
          
          // Skip posts with no meaningful content
          if (!cleanContent || cleanContent.length < 10) {
            console.log(`Skipping ${file}: insufficient content`);
            continue;
          }

          const blogPost = {
            id: post.slug || file.replace('.json', ''),
            slug: post.slug || file.replace('.json', ''),
            content: cleanContent,
            title: post.title || '',
            excerpt: post.excerpt || '',
            authorName: post.authors?.[0]?.name || 'Unknown',
            authorEmail: post.authors?.[0]?.email || '',
            publishedDate: post.date || '',
            interactionCount: post.interactionStatistic?.userInteractionCount || 0
          };

          blogPosts.push(blogPost);
        }
      } catch (error) {
        console.error(`Error processing ${file}:`, error.message);
      }
    }

    // Group posts by whether they need title/excerpt generation
    const needsGeneration = blogPosts.filter(post => 
      !post.title || !post.excerpt || post.title.trim() === '' || post.excerpt.trim() === ''
    );
    
    const hasMetadata = blogPosts.filter(post => 
      post.title && post.excerpt && post.title.trim() !== '' && post.excerpt.trim() !== ''
    );

    console.log('\n=== BLOG POSTS MIGRATION SUMMARY ===');
    console.log(`Total posts found: ${blogPosts.length}`);
    console.log(`Posts needing title/excerpt generation: ${needsGeneration.length}`);
    console.log(`Posts with existing metadata: ${hasMetadata.length}`);

    // Save the prepared data
    const outputFile = path.join(__dirname, 'blog_posts_for_migration.json');
    fs.writeFileSync(outputFile, JSON.stringify(blogPosts, null, 2));
    
    console.log(`\nPrepared blog posts saved to: ${outputFile}`);
    
    // Also create a sample for testing individual posts
    if (needsGeneration.length > 0) {
      const sampleMissingMetadata = needsGeneration[0];
      console.log('\n=== SAMPLE POST MISSING METADATA ===');
      console.log(JSON.stringify(sampleMissingMetadata, null, 2));
    }

    if (hasMetadata.length > 0) {
      const sampleWithMetadata = hasMetadata[0];
      console.log('\n=== SAMPLE POST WITH METADATA ===');
      console.log(JSON.stringify(sampleWithMetadata, null, 2));
    }

    console.log('\n=== NEXT STEPS ===');
    console.log('1. Start your MCP development server: npm run dev');
    console.log('2. Go to your deco.chat workspace interface');
    console.log('3. Use the PROCESS_BLOG_POST workflow with individual posts for testing');
    console.log('4. Use the MIGRATE_ALL_BLOG_POSTS workflow with the full array for bulk migration');
    console.log(`5. Or use the saved file: ${outputFile}`);

    return blogPosts;

  } catch (error) {
    console.error('Error preparing blog posts for migration:', error);
    return [];
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  prepareBlogPostsForMigration();
}

export { prepareBlogPostsForMigration };