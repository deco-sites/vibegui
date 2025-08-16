export interface Author {
  name: string;
  email?: string;
}

export interface Category {
  name: string;
  slug: string;
}

export interface UpdateFields {
  title?: string;
  excerpt?: string;
  content?: string; // rich-text HTML
  date?: string; // YYYY-MM-DD
  slug?: string; // optional slug override
  image?: string; // optional image URL
  authors?: Author[];
  categories?: Category[];
}

export interface Props {
  // How to locate the post block on disk
  match: {
    urn?: string; // preferred: numeric/string id used as filename
    slug?: string; // fallback: search by post.slug
  };
  // Partial fields to update
  update: UpdateFields;
}

type BlogBlock = {
  name: string;
  __resolveType: string;
  post: {
    authors?: Author[];
    content?: string;
    slug: string;
    date?: string;
    title?: string;
    image?: string;
    categories?: Category[];
    excerpt?: string;
    interactionStatistic?: { "@type": string; userInteractionCount?: number };
  };
};

async function readJsonPath<T>(path: string): Promise<T> {
  const text = await Deno.readTextFile(path);
  return JSON.parse(text) as T;
}

async function writeJsonPath(path: string, data: unknown): Promise<void> {
  const dir = path.replace(/\/?[^/]*$/, "/");
  await Deno.mkdir(dir, { recursive: true }).catch(() => {});
  await Deno.writeTextFile(path, JSON.stringify(data, null, 2));
}

function blocksDirPath(): string {
  // Absolute dir path; files are flat with %2F in names
  return `${Deno.cwd().replace(/\\/g, "/")}/.deco/blocks/`;
}

const BLOG_PREFIX_ENC = encodeURIComponent("collections/blog/posts/"); // collections%2Fblog%2Fposts%2F

async function findBlockBySlug(slug: string): Promise<string | null> {
  const dirPath = blocksDirPath();
  for await (const entry of Deno.readDir(dirPath)) {
    if (!entry.isFile || !entry.name.endsWith(".json")) continue;
    if (!entry.name.startsWith(BLOG_PREFIX_ENC)) continue;
    const filePath = dirPath + entry.name;
    try {
      const block = await readJsonPath<BlogBlock>(filePath);
      if (block?.post?.slug === slug) return filePath;
    } catch (_) {
      // ignore malformed files
    }
  }
  return null;
}

function toPath(u: URL): string {
  return decodeURIComponent(u.pathname);
}

export default async function loader(props: Props): Promise<BlogBlock> {
  const { match, update } = props;
  const base = blocksDirPath();
  console.log("[UpsertBlogPost] start", { cwd: Deno.cwd(), match, update, dir: base });

  let filePath: string | null = null;
  if (match.urn) {
    filePath = base + BLOG_PREFIX_ENC + encodeURIComponent(match.urn) + ".json";
  }
  if (!filePath && match.slug) {
    filePath = base + BLOG_PREFIX_ENC + encodeURIComponent(match.slug) + ".json";
  }

  if (!filePath) {
    console.error("[UpsertBlogPost] no match provided");
    throw new Error("Provide urn or slug");
  }

  console.log("[UpsertBlogPost] resolved path", { file: filePath });
  let existing: BlogBlock | null = null;
  try {
    existing = await readJsonPath<BlogBlock>(filePath);
    console.log("[UpsertBlogPost] existing file loaded", { file: filePath });
  } catch (err) {
    console.log("[UpsertBlogPost] creating new file", { file: filePath, err: String(err) });
    const baseId = match.urn ?? match.slug ?? crypto.randomUUID();
    existing = {
      name: `collections/blog/posts/${baseId}`,
      __resolveType: "blog/loaders/Blogpost.ts",
      post: {
        authors: update.authors ?? [{ name: "Guilherme Rodrigues", email: "" }],
        content: update.content ?? "",
        slug: update.slug ?? String(baseId),
        date: update.date ?? new Date().toISOString().slice(0, 10),
        title: update.title ?? "",
        image: update.image,
        categories: update.categories ?? [{ name: "LinkedIn", slug: "linkedin" }],
        excerpt: update.excerpt ?? "",
      },
    };
  }

  // Merge updates into block.post
  const block = existing!;
  block.post = {
    ...block.post,
    ...(update.title !== undefined ? { title: update.title } : {}),
    ...(update.excerpt !== undefined ? { excerpt: update.excerpt } : {}),
    ...(update.content !== undefined ? { content: update.content } : {}),
    ...(update.date !== undefined ? { date: update.date } : {}),
    ...(update.slug !== undefined ? { slug: update.slug } : {}),
    ...(update.image !== undefined ? { image: update.image } : {}),
    ...(update.authors !== undefined ? { authors: update.authors } : {}),
    ...(update.categories !== undefined ? { categories: update.categories } : {}),
  };

  await writeJsonPath(filePath, block);
  console.log("[UpsertBlogPost] updated", { file: filePath, applied: update });
  return block;
}


