// deno run -A scripts/make_top_posts.ts dataset_linkedin-profile-posts_*.json
// Sorts the original dataset by total reactions (desc), then scans from the top
// and picks the first 50 posts authored by Guilherme Rodrigues (username "vibegui").
// For each, writes a blog block JSON under .deco/blocks/collections%2Fblog%2Fposts%2F{urn}.json
// Note: No title generation via code/heuristics. Title/excerpt are left blank for LLM to fill later.

type LinkedInPost = {
  urn: string;
  posted_at?: { date?: string };
  text?: string;
  post_type?: string;
  author?: { first_name?: string; last_name?: string; username?: string };
  stats?: { total_reactions?: number };
};

async function ensureDir(path: string) {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (_) {
    // ignore if exists
  }
}

function toParagraphs(text: string | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  return t
    .split(/\n\n+/g)
    .map((p) => `<p>${p.replace(/\n/g, "<br>").trim()}</p>`)
    .join("");
}

function byMe(post: LinkedInPost): boolean {
  const isMe =
    post.author?.username?.toLowerCase() === "vibegui" ||
    (post.author?.first_name?.toLowerCase() === "guilherme" &&
      post.author?.last_name?.toLowerCase() === "rodrigues");
  const isRegular = (post.post_type ?? "regular").toLowerCase() === "regular";
  return !!(isMe && isRegular);
}

async function main() {
  const inputPath = Deno.args[0] ?? "dataset_linkedin-profile-posts_2025-08-16_16-44-33-648.json";
  const outDir = ".deco/blocks/collections%2Fblog%2Fposts%2F";
  await ensureDir(outDir);

  const raw = await Deno.readTextFile(inputPath);
  const data: LinkedInPost[] = JSON.parse(raw);

  // Sort by total reactions desc using only original dataset
  const sorted = [...data].sort((a, b) => (b.stats?.total_reactions ?? 0) - (a.stats?.total_reactions ?? 0));

  const selected: LinkedInPost[] = [];
  for (const p of sorted) {
    if (byMe(p)) selected.push(p);
    if (selected.length >= 50) break;
  }

  for (const post of selected) {
    const block = {
      name: `collections/blog/posts/${post.urn}`,
      __resolveType: "blog/loaders/Blogpost.ts",
      post: {
        authors: [{ name: "Guilherme Rodrigues", email: "" }],
        content: toParagraphs(post.text),
        slug: post.urn, // slug left as urn for stability; feel free to revise later
        date: (post.posted_at?.date ?? "").slice(0, 10),
        title: "",
        categories: [{ name: "LinkedIn", slug: "linkedin" }],
        excerpt: "",
        interactionStatistic: {
          "@type": "InteractionCounter",
          userInteractionCount: post.stats?.total_reactions ?? 0,
        },
      },
    } as const;

    const outPath = `${outDir}${encodeURIComponent(post.urn)}.json`;
    await Deno.writeTextFile(outPath, JSON.stringify(block, null, 2));
  }

  console.log(`Wrote ${selected.length} posts to ${outDir}`);
}

if (import.meta.main) {
  await main();
}


