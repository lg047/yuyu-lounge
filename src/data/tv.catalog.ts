// Catalog of channels and episodes. Fill URLs as you upload.
// If DNS for media.yuyulounge.com is still pending, temporarily use your r2.dev base.

export type Episode = { id: string; title: string; url: string; duration_s?: number };
export type ChannelId = "pooh" | "lilo" | "ducktales";
export type Channel = { id: ChannelId; title: string; episodes: Episode[] };

export const CATALOG: Channel[] = [
  {
    id: "pooh",
    title: "Winnie the Pooh",
    episodes: [
      {
        id: "pooh_s01e01_pooh-oughta-be-in-pictures",
        title: "S1E1 • Pooh Oughta Be in Pictures",
        url: "https://pub-1d39836bb1d54ab8b78e037750c0ee43.r2.dev/tv/pooh/pooh_s01e01/index.m3u8",
      },
      // add more Pooh episodes here as they finish uploading
      // { id: "pooh_s01e13_honey-bunny-and-trap", title: "S1E13 • Honey for a Bunny; Trap as Trap Can", url: "https://media.yuyulounge.com/tv/pooh/pooh_s01e13/index.m3u8" },
      // { id: "pooh_s02e03_piglet-gone-up-up-and-awry", title: "S2E3 • Piglet Gone; Up, Up and Awry", url: "https://media.yuyulounge.com/tv/pooh/pooh_s02e03/index.m3u8" },
      // { id: "pooh_s03e09_easy-gopher-pooh-snatchers", title: "S3E9 • Easy Gopher; Pooh Snatchers", url: "https://media.yuyulounge.com/tv/pooh/pooh_s03e09/index.m3u8" },
    ],
  },
  {
    id: "lilo",
    title: "Lilo & Stitch",
    episodes: [
      // { id: "lilo_s02e02_frenchfry-experiment-062", title: "S2E2 • Frenchfry 062", url: "https://media.yuyulounge.com/tv/lilo/lilo_s02e02/index.m3u8" },
      // { id: "lilo_s01e16_sprout-experiment-509",   title: "S1E16 • Sprout 509",    url: "https://media.yuyulounge.com/tv/lilo/lilo_s01e16/index.m3u8" },
      // { id: "lilo_s01e09_yin-yang-experiments-501-502", title: "S1E9 • Yin Yang 501 502", url: "https://media.yuyulounge.com/tv/lilo/lilo_s01e09/index.m3u8" },
      // { id: "lilo_s01e05_spooky-experiment-300",   title: "S1E5 • Spooky 300",    url: "https://media.yuyulounge.com/tv/lilo/lilo_s01e05/index.m3u8" },
    ],
  },
  {
    id: "ducktales",
    title: "DuckTales",
    episodes: [
      // { id: "ducktales_s01e01_the-epic-beginning-dont-give-up-the-ship", title: "S1E1 • The Epic Beginning", url: "https://media.yuyulounge.com/tv/ducktales/ducktales_s01e01/index.m3u8" },
      // { id: "ducktales_s01e08_where-no-duck-has-gone-before-cartonova-720p", title: "S1E8 • Where No Duck Has Gone Before", url: "https://media.yuyulounge.com/tv/ducktales/ducktales_s01e08/index.m3u8" },
      // { id: "ducktales_s01e61_once-upon-a-dime", title: "S1E61 • Once Upon a Dime", url: "https://media.yuyulounge.com/tv/ducktales/ducktales_s01e61/index.m3u8" },
    ],
  },
];

export default CATALOG;
