import type { APIRoute } from "astro";
import { getChapterSlugs, requireChapter } from "../../../lib/content";

export const prerender = true;

export async function getStaticPaths() {
  return (await getChapterSlugs()).map((slug) => ({ params: { slug } }));
}

export const GET: APIRoute = async ({ params }) => {
  const chapter = await requireChapter(params.slug!);
  const body = chapter.reading.segments
    .map((segment: { heading?: string; text: string }) => [segment.heading, segment.text].filter(Boolean).join("\n\n"))
    .join("\n\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
