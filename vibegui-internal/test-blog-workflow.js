// Simple test script to verify our blog system
// This would be run from the deco.chat interface or via API calls

const sampleBlogPost = {
  id: "test_7242328454828830721", 
  slug: "7242328454828830721",
  content: "Todo dia eu durmo feliz por saber que a minha empresa não vende vício, jogo e aposta pra pagar as contas. Boa noite!",
  title: "", // Missing title
  excerpt: "", // Missing excerpt
  authorName: "Guilherme Rodrigues",
  authorEmail: "",
  publishedDate: "2024-09-19",
  interactionCount: 172
};

const sampleBlogPost2 = {
  id: "test_1c8bb9f3d71d",
  slug: "1c8bb9f3d71d", 
  content: "The web is the most important computing platform of our time. It's open, accessible, and constantly evolving. We believe in building for the web because it democratizes access to information and tools.",
  title: "Why we web", // Existing title
  excerpt: "Building for the most important computing platform", // Existing excerpt
  authorName: "Guilherme Rodrigues",
  publishedDate: "2024-08-15",
  interactionCount: 45
};

console.log("Sample blog posts for testing:");
console.log("1. Portuguese post missing title/excerpt:", JSON.stringify(sampleBlogPost, null, 2));
console.log("\n2. English post with existing title/excerpt:", JSON.stringify(sampleBlogPost2, null, 2));

console.log("\nTo test the workflows:");
console.log("1. Use the deco.chat interface to run the PROCESS_BLOG_POST workflow with these sample posts");
console.log("2. The system should:");
console.log("   - Detect Portuguese for post 1, English for post 2");  
console.log("   - Generate title/excerpt for post 1 in Portuguese");
console.log("   - Keep existing title/excerpt for post 2");
console.log("   - Insert both posts into the database");