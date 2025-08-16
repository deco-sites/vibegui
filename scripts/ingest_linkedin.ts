// deno run -A scripts/ingest_linkedin.ts dataset_linkedin-profile-posts_*.json
// Reads a LinkedIn dataset JSON (array), splits into .temp files, filters posts
// authored by Guilherme Rodrigues (username vibegui) and creates .deco blog blocks.

type LinkedInPost = {
  urn: string;
  posted_at?: { date?: string };
  text?: string;
  url?: string;
  post_type?: string; // "regular", "repost", etc
  author?: {
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  stats?: { total_reactions?: number };
  media?: {
    type?: string;
    images?: { url: string }[];
    url?: string;
    thumbnail?: string;
  };
};

function ensureDir(path: string) {
  return Deno.mkdir(path, { recursive: true }).catch(() => {});
}

function toParagraphs(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n\n+/g)
    .map((p) => `<p>${p.replace(/\n/g, "<br>").trim()}</p>`) // preserve single line breaks
    .join("");
}

function deduceTitle(text: string): string {
  const firstSentence = (text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)[0]
    .slice(0, 80)
    .trim();
  return firstSentence || "Untitled";
}

function deduceExcerpt(text: string): string {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  return normalized.slice(0, 160);
}

function slugify(base: string, fallback: string): string {
  const raw = base || fallback;
  return raw
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || fallback;
}

async function main() {
  const inputPath = Deno.args[0] ?? "dataset_linkedin-profile-posts_2025-08-16_16-44-33-648.json";
  const raw = await Deno.readTextFile(inputPath);
  const data: LinkedInPost[] = JSON.parse(raw);

  await ensureDir(".temp/linkedInPosts");
  await ensureDir(".deco/blocks");

  const postsByMe: LinkedInPost[] = [];

  for (const post of data) {
    // Save each raw post into .temp
    const tempOut = `.temp/linkedInPosts/${post.urn}.json`;
    await Deno.writeTextFile(tempOut, JSON.stringify(post, null, 2));

    // Filter: author me + regular post
    const isMe =
      (post.author?.username?.toLowerCase() === "vibegui") ||
      ((post.author?.first_name?.toLowerCase() === "guilherme") &&
        (post.author?.last_name?.toLowerCase() === "rodrigues"));
    const isRegular = (post.post_type ?? "regular").toLowerCase() === "regular";
    if (isMe && isRegular) postsByMe.push(post);
  }

  // Sort by total_reactions desc
  postsByMe.sort((a, b) => (b.stats?.total_reactions ?? 0) - (a.stats?.total_reactions ?? 0));

  // Create .deco/blocks for each authored post
  const outDir = ".deco/blocks/collections%2Fblog%2Fposts%2F";
  await ensureDir(outDir);

  for (const post of postsByMe) {
    const text = post.text ?? "";
    const title = deduceTitle(text);
    const excerpt = deduceExcerpt(text);
    const content = toParagraphs(text);
    const date = (post.posted_at?.date ?? "").slice(0, 10);
    const baseSlug = slugify(title, post.urn);

    const image = post.media?.type?.startsWith("image")
      ? post.media?.images?.[0]?.url ?? undefined
      : undefined;

    const block = {
      name: `collections/blog/posts/${post.urn}`,
      __resolveType: "blog/loaders/Blogpost.ts",
      post: {
        authors: [{ name: "Guilherme Rodrigues", email: "" }],
        content,
        slug: baseSlug,
        date,
        title,
        ...(image ? { image } : {}),
        categories: [{ name: "LinkedIn", slug: "linkedin" }],
        excerpt,
        interactionStatistic: {
          "@type": "InteractionCounter",
          userInteractionCount: post.stats?.total_reactions ?? 0,
        },
      },
    } as const;

    const outPath = `${outDir}${encodeURIComponent(post.urn)}.json`;
    await Deno.writeTextFile(outPath, JSON.stringify(block, null, 2));
  }

  console.log(`Wrote ${postsByMe.length} posts to ${outDir}`);
}

if (import.meta.main) {
  await main();
}


