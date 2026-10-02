import type { Metadata } from "next";
import RaceCalendar from "@/components/RaceCalendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Zealand Feature Race Calendar",
  description: "New Zealand harness racing Group and feature race dates for pacers and trotters — venues, classes and stakes.",
  alternates: { canonical: "https://harnesslink.com/feature-race-calendar-nz/" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  return <RaceCalendar scope="NZ" searchParams={await searchParams} />;
}
