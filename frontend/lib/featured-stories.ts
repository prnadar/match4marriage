/* Featured success stories shown on the landing page Stories section and
 * the dedicated /success-stories page. Editing this list updates both
 * surfaces. If a `img` file is missing on disk the card falls back to a
 * blush monogram tile so it still looks intentional. */

export type FeaturedStory = {
  img: string;
  names: string;
  location: string;
  year: string;            // pre-formatted ("Married 2026")
  yearNumber: number;      // raw year, used by the API merge
  quote: string;
};

export const featuredStories: FeaturedStory[] = [
  {
    img: "/couples/alex-nisha.jpg",
    names: "Alex & Nisha",
    location: "Nottingham & Mumbai",
    year: "Married 2026",
    yearNumber: 2026,
    quote:
      "Match4Marriage took the time to understand both our families before introducing us. From the first conversation to the wedding, every step felt considered and personal. We are so grateful for the way they brought us together.",
  },
  {
    img: "/couples/ashwini-rahul.jpg",
    names: "Ashwini & Rahul",
    location: "Birmingham & Kerala",
    year: "Married 2024",
    yearNumber: 2024,
    quote:
      "We come from different parts of the country but our families shared the same values, and Match4Marriage saw that straight away. The advisors guided us with care through every conversation, and our wedding in Kerala was everything we hoped for.",
  },
];

/** Initials joined by &, e.g. "Alex & Nisha" → "A & N". Used by the monogram
 *  fallback tile when the photo isn't on disk yet. */
export function monogramFor(names: string): string {
  return names
    .split("&")
    .map((part) => part.trim()[0]?.toUpperCase() || "")
    .filter(Boolean)
    .join(" & ");
}
