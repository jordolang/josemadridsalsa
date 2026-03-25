import { notFound } from "next/navigation";
import type { Metadata } from "next";

/**
 * Battle Arena fundraiser profile page.
 *
 * NOTE: This feature is under development. The FundraiserTeam, FundraiserShield,
 * and FundraiserSaleEvent Prisma models have not been added to the schema yet.
 * Until those migrations are run, this page returns 404.
 */

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params: _params }: Props): Promise<Metadata> {
  return { title: "Fundraiser Battle Arena — Coming Soon" };
}

export default async function FundraiserProfilePage({ params: _params }: Props) {
  // Battle Arena models not yet in DB schema — redirect to 404 until ready
  notFound();
}
