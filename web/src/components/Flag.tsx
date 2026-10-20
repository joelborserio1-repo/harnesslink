// Country flags for the menus (flag-icons, MIT — stored in /public/flags).
export type FlagCode = "au" | "nz" | "us" | "ca" | "eu" | "se" | "fr" | "gb";

export default function Flag({ code, className = "" }: { code: FlagCode; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/flags/${code}.svg`} alt="" width={30} height={22} className={`inline-block h-[22px] w-[30px] shrink-0 ${className}`} />
  );
}
