import type { Metadata } from "next";
import RaceCalendar from "@/components/RaceCalendar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Australia Feature Race Calendar",
  description: "Australian harness racing Group and feature race dates for pacers and trotters — venues, states, classes and stakes.",
  alternates: { canonical: "https://harnesslink.com/feature-race-calendar-au/" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Page({ searchParams }: Props) {
  return <RaceCalendar scope="AU" searchParams={await searchParams} />;
}
