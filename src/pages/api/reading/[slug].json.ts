import type { APIRoute } from "astro";
import { getChapterSlugs, requireChapter } from "../../../lib/content";

export const prerender = true;

export async function getStaticPaths() {
  return (await getChapterSlugs()).map((slug) => ({ params: { slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const chapter = await requireChapter(params.slug!);
  return new Response(JSON.stringify(chapter.reading, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
