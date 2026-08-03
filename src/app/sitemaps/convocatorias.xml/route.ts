import { contestEntries, urlsetXml, xmlResponse } from "@/lib/sitemaps";

export const revalidate = 3600;

export async function GET() {
  return xmlResponse(urlsetXml(await contestEntries()));
}
