import type { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "Sponsors | NSW Standardbred Owners Association",
  description:
    "The NSWSOA would like to thank its generous sponsors and encourages its members to support them in kind.",
}

// Sponsor logos are hosted on the Wix CDN. To turn any card into a link,
// drop a real URL into `website`; leave it as "" to render the card without a
// link. The grid is otherwise unchanged.
type Sponsor = {
  name: string
  logo: string
  website: string
}

const sponsors: Sponsor[] = [
  { name: "Sponsor 1", logo: "https://static.wixstatic.com/media/1a14f6_687df19a6914478db912297a3c169669~mv2.png", website: "" },
  { name: "Sponsor 2", logo: "https://static.wixstatic.com/media/1a14f6_e3b5b1484d9c4fa2a2f8ae4c2aeec0b6~mv2.png", website: "" },
  { name: "Sponsor 3", logo: "https://static.wixstatic.com/media/1a14f6_7e16294fda9d411c98c149e4c422b023~mv2.png", website: "" },
  { name: "Sponsor 4", logo: "https://static.wixstatic.com/media/1a14f6_785a820c34124093a9477057096c6202~mv2.png", website: "" },
  { name: "Sponsor 5", logo: "https://static.wixstatic.com/media/1a14f6_f52b7ee048fc4114854e699c6522583e~mv2.jpg", website: "" },
  { name: "Sponsor 6", logo: "https://static.wixstatic.com/media/1a14f6_c5936538952e40fa918d0b010526437b~mv2.png", website: "" },
  { name: "Sponsor 7", logo: "https://static.wixstatic.com/media/1a14f6_c72cfdf5c5424799babb4e1e404818f8~mv2.gif", website: "" },
  { name: "Sponsor 8", logo: "https://static.wixstatic.com/media/1a14f6_21d4c16d3a3146508bfb115c3973eb90~mv2.png", website: "" },
  { name: "Sponsor 9", logo: "https://static.wixstatic.com/media/1a14f6_2661b93948f842dab1cf758da89e7aa2~mv2.png", website: "" },
  { name: "Sponsor 10", logo: "https://static.wixstatic.com/media/1a14f6_646ca69c0b4849979ee6f9945aacb36c~mv2.jpg", website: "" },
  { name: "Sponsor 11", logo: "https://static.wixstatic.com/media/1a14f6_f9cfab20730e4d10914d446a7bf36505~mv2.png", website: "" },
]

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const card = (
    <div className="bg-white border border-warm-grey rounded-md p-6 h-32 flex items-center justify-center transition-hover hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-full w-full">
        <Image
          src={sponsor.logo}
          alt={sponsor.name}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-contain"
        />
      </div>
    </div>
  )

  if (sponsor.website && sponsor.website !== "#") {
    return (
      <a
        href={sponsor.website}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {card}
      </a>
    )
  }

  return card
}

export default function SponsorsPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-navy-primary py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="section-label mb-3">Our Sponsors</p>
          <h1 className="font-serif text-4xl lg:text-5xl text-white mb-4">Sponsors</h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            The NSWSOA would like to thank its generous sponsors and encourages its members to support them in kind.
          </p>
        </div>
      </section>

      {/* Sponsor logo grid */}
      <section className="py-12 lg:py-16 bg-off-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {sponsors.map((sponsor) => (
              <SponsorCard key={sponsor.logo} sponsor={sponsor} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
