// deno run -A scripts/list_missing_blog_fields.ts
// Lists slugs and contents of all blog post blocks that are missing BOTH title and excerpt

type BlogBlock = {
  name: string;
  __resolveType: string;
  post?: {
    slug?: string;
    title?: string;
    excerpt?: string;
    content?: string;
  };
};

const BLOCKS_DIR = `${Deno.cwd().replace(/\\/g, "/")}/.deco/blocks/`;
const BLOG_PREFIX = encodeURIComponent("collections/blog/posts/"); // collections%2Fblog%2Fposts%2F

async function main() {
  const results: Array<{ slug: string; content: string; file: string }> = [];
  for await (const entry of Deno.readDir(BLOCKS_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;
    if (!entry.name.startsWith(BLOG_PREFIX)) continue;
    const filePath = BLOCKS_DIR + entry.name;
    try {
      const raw = await Deno.readTextFile(filePath);
      const block = JSON.parse(raw) as BlogBlock;
      const post = block.post ?? {};
      const titleMissing = !post.title || post.title.trim().length === 0;
      const excerptMissing = !post.excerpt || post.excerpt.trim().length === 0;
      if (titleMissing && excerptMissing) {
        results.push({ slug: String(post.slug ?? entry.name), content: String(post.content ?? ""), file: filePath });
      }
    } catch (_) {
      // ignore malformed files
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

if (import.meta.main) {
  await main();
}


