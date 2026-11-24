import {
  Archive,
  AudioLines,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Languages,
  LayoutGrid,
  ListChecks,
  MonitorPlay,
  Sparkles,
  Users,
} from "lucide-react";

export const topics = [
  {
    id: "start",
    icon: BookOpen,
    label: "Start here",
    group: "Introduction",
    desc: "Understand how Nahhasio organizes works, video, and viewing progress.",
  },
  {
    id: "browse",
    icon: LayoutGrid,
    label: "Browse the library",
    group: "Explore the catalog",
    desc: "Search titles and aliases and choose how results appear.",
  },
  {
    id: "credits",
    icon: Languages,
    label: "Titles and dubbing",
    group: "Explore the catalog",
    desc: "Explore installments, Arabic dub credits, and episode artwork.",
  },
  {
    id: "discovery",
    icon: CalendarDays,
    label: "Discover people and releases",
    group: "Explore the catalog",
    desc: "Follow the calendar or browse the people and organizations behind a title.",
  },
  {
    id: "tracking",
    icon: Users,
    label: "Watch history and profiles",
    group: "Watching and saving",
    desc: "Understand what is personal and what family members can see.",
  },
  {
    id: "playback",
    icon: MonitorPlay,
    label: "Playback",
    group: "Watching and saving",
    desc: "Find episodes, available tracks, and viewing controls.",
  },
  {
    id: "offline",
    icon: Archive,
    label: "Save and watch offline",
    group: "Watching and saving",
    desc: "Choose between saving a title and keeping its video.",
  },
  {
    id: "organize",
    icon: ListChecks,
    label: "Organize the collection",
    group: "Curating a library",
    desc: "Edit catalog records and review video matches.",
  },
  {
    id: "artwork",
    icon: Sparkles,
    label: "Artwork and editorial details",
    group: "Curating a library",
    desc: "Work with images, ratings, and notes.",
  },
];

export const groups = [
  {
    id: "catalog",
    label: "Catalog and discovery",
    icon: LayoutGrid,
    summary:
      "Look up the title you remember, then follow its credits, installments, and release dates.",
    items: [
      {
        title: "Arabic and English search",
        detail:
          "Search by either title or a known alias in an Arabic-first, right-to-left interface.",
        guide: "browse",
      },
      {
        title: "Four Browse layouts",
        detail:
          "Choose posters, banners, logos, or a table. Each layout remembers its own display settings.",
        guide: "browse",
      },
      {
        title: "Detailed filters and sorting",
        detail:
          "Combine viewing state, favorites, release details, studio, audience, and score filters. Switch between works and installments.",
        guide: "browse",
      },
      {
        title: "Dubbing credits",
        detail:
          "Keep Arabic dubbing notes with the work. Credit contributions can identify people, studios, and languages.",
        guide: "credits",
      },
      {
        title: "People and studios",
        detail:
          "Search their directories by name or alias, sort by work count, and follow credits back to the catalog.",
        guide: "discovery",
      },
      {
        title: "Release calendar",
        detail:
          "See movies, season starts, and registered episodes in calendar, timeline, season, and upcoming views.",
        guide: "discovery",
      },
    ],
  },
  {
    id: "family",
    label: "Watching together, at your own pace",
    icon: Users,
    summary: "Share the catalog and the conversation. Each viewing account keeps its own place.",
    items: [
      {
        title: "Resume and watch history",
        detail:
          "Continue an episode from a recorded position and keep completed titles and episodes in your own history.",
        guide: "tracking",
      },
      {
        title: "Mark watched by scope",
        detail:
          "Record a whole work, one installment, or a single episode as watched, including something you saw elsewhere.",
        guide: "tracking",
      },
      {
        title: "Favorites and profiles",
        detail:
          "Keep favorites and view activity. Profiles surface family-visible collections, reviews, and comments.",
        guide: "tracking",
      },
      {
        title: "Spoiler-aware discussion",
        detail:
          "Discuss a work and reply to family members. Spoiler text stays concealed until revealed.",
        guide: "tracking",
      },
    ],
  },
  {
    id: "watch",
    label: "Playback and offline",
    icon: AudioLines,
    summary:
      "Find episodes and available tracks, then keep what you need for viewing away from home.",
    items: [
      {
        title: "Episode navigator",
        detail:
          "Search and sort episodes or show only unwatched episodes. Film pages keep the focus on the video.",
        guide: "playback",
      },
      {
        title: "Audio and subtitle tracks",
        detail: "Choose the audio track and subtitles available for the current video.",
        guide: "playback",
      },
      {
        title: "Saved works",
        detail: "Keep catalog details, artwork, and viewing information for offline browsing.",
        guide: "offline",
      },
      {
        title: "Device downloads",
        detail:
          "Keep complete video files on the device for offline playback. See retained videos in the device downloads view.",
        guide: "offline",
      },
    ],
  },
  {
    id: "curation",
    label: "Collection curation",
    icon: Clapperboard,
    summary: "Build a catalog with enough detail to record what matters to your family.",
    items: [
      {
        title: "Works, installments, and episodes",
        detail:
          "Edit films and series, including seasons, episode details, and trailers. Catalog an entry before you have its video.",
        guide: "organize",
      },
      {
        title: "Artwork, credits, and recognition",
        detail:
          "Manage posters, logos, banners, and episode stills alongside credits, studio relationships, and awards.",
        guide: "artwork",
      },
      {
        title: "Editorial ratings and notes",
        detail:
          "Keep scores, content warnings, and analysis attached to the catalog. Review score breakdowns where available.",
        guide: "artwork",
      },
      {
        title: "Reviewed file matching",
        detail:
          "Check the title, installment, and episode association before importing a video into the collection.",
        guide: "organize",
      },
    ],
  },
];

export const screenshots = [
  {
    id: "desktop-home",
    title: "Home",
    description: "The library’s home screen and viewing shortcuts.",
  },
  {
    id: "desktop-browse",
    title: "Browse",
    description: "Arabic title search, filters, and the poster layout.",
  },
  {
    id: "desktop-work",
    title: "Work details",
    description: "Dubbing credits, seasons, episodes, and artwork.",
  },
  {
    id: "desktop-watch",
    title: "Watch",
    description: "The player, episode navigation, and viewing actions.",
  },
  {
    id: "desktop-people",
    title: "People",
    description: "The people directory and its catalog credits.",
  },
  {
    id: "desktop-studios",
    title: "Studios",
    description: "Studios and the works they are credited on.",
  },
  {
    id: "desktop-settings",
    title: "Settings",
    description: "App appearance, account, and viewing preferences.",
  },
  {
    id: "desktop-admin",
    title: "Library administration",
    description: "Catalog editing and reviewed file matching.",
  },
  { id: "mobile-home", title: "Home", description: "The library’s home screen at phone width." },
  { id: "mobile-browse", title: "Browse", description: "Compact poster browsing." },
  {
    id: "mobile-filters",
    title: "Browse filters",
    description: "Category and viewing filters at phone width.",
  },
  {
    id: "mobile-work",
    title: "Work details",
    description: "Title details and credits in a narrow layout.",
  },
  { id: "mobile-episodes", title: "Episodes", description: "The season and episode list." },
  { id: "mobile-watch", title: "Watch", description: "Viewing controls and episode navigation." },
  { id: "mobile-profile", title: "Profile", description: "Viewing activity and favorites." },
  { id: "mobile-settings", title: "Settings", description: "The responsive settings layout." },
];
