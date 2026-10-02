import type { Metadata } from "next";
import RaceCalendar from "@/components/RaceCalendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "United States Race Calendar",
  description: "United States harness racing stakes and feature race dates — tracks, divisions, grades and purses.",
  alternates: { canonical: "https://harnesslink.com/united-states-race-calendar/" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  return <RaceCalendar scope="US" searchParams={await searchParams} />;
}
