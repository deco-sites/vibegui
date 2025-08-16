// deno run -A scripts/split_linkedin.ts dataset_linkedin-profile-posts_*.json
// Minimal splitter: writes each post to .temp/linkedInPosts/{urn}.json

type LinkedInPost = {
  urn: string;
};

async function ensureDir(path: string) {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (_) {}
}

async function main() {
  const inputPath = Deno.args[0] ?? "dataset_linkedin-profile-posts_2025-08-16_16-44-33-648.json";
  const outDir = ".temp/linkedInPosts";
  await ensureDir(outDir);

  const raw = await Deno.readTextFile(inputPath);
  const data: LinkedInPost[] = JSON.parse(raw);

  let count = 0;
  for (const post of data) {
    if (!post?.urn) continue;
    await Deno.writeTextFile(`${outDir}/${post.urn}.json`, JSON.stringify(post, null, 2));
    count++;
  }
  await Deno.writeTextFile(`${outDir}/index.json`, JSON.stringify({ count }, null, 2));
  console.log(`Split ${count} posts into ${outDir}`);
}

if (import.meta.main) {
  await main();
}


