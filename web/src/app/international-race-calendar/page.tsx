import type { Metadata } from "next";
import RaceCalendar from "@/components/RaceCalendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "International Race Calendar",
  description: "Harness racing feature race dates for Australia, New Zealand, the United States and Canada — venues, classes, grades and stakes in one calendar.",
  alternates: { canonical: "https://harnesslink.com/international-race-calendar/" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  return <RaceCalendar scope="INTL" searchParams={await searchParams} />;
}
