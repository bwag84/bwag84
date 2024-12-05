import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://bwag84.github.io", // replace this with your deployed domain
  author: "Bart Wagener",
  profile: "https://bartwagener.com",
  desc: "My personal overengineered blog",
  title: "bartWagener dot com,",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 3,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  editPost: {
    url: "https://bwag84.github.io/edit/main",
    text: "Suggest Changes",
    appendFilePath: true,
  },
};

export const LOCALE = {
  lang: "en", // html lang code. Set this empty and default will be "en"
  langTag: ["en-nl"], // BCP 47 Language Tags. Set this empty [] to use the environment default
} as const;

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/bwag84",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/bartwagener/",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
  {
    name: "X",
    href: "https://x.com/bartwagener",
    linkTitle: `${SITE.title} on X`,
    active: false,
  },
  {
    name: "CodePen",
    href: "https://codepen.io/bwag84/",
    linkTitle: `${SITE.title} on CodePen`,
    active: false,
  },

];
