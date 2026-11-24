import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Film,
  ImageIcon,
  LayoutGrid,
  Monitor,
  Smartphone,
  ListVideo,
  Search,
  X,
} from "lucide-react";
import type React from "react";

import { groups, screenshots, topics } from "./content";
import { Badge } from "./shadcn/badge";
import { Button, buttonVariants } from "./shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./shadcn/card";
import { Input } from "./shadcn/input";

type Entry = {
  id: string;
  title: string;
  html: string;
  text: string;
  headings: { id: string; title: string }[];
};

type Assets = { mark: string; screenshots: Record<string, string> };

export { screenshots };

const navigation = [
  ["home/features", "Features"],
  ["home/screenshots", "Screenshots"],
  ["changelog", "Changelog"],
];

const starterTopics = new Set(["browse", "credits", "playback", "offline"]);
const topicGroups = [...new Set(topics.map((topic) => topic.group))];

function Action({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <a
      className={buttonVariants({ size: "lg", variant: secondary ? "outline" : "default" })}
      href={href}
    >
      {children}
    </a>
  );
}

function SearchButton({ sidebar = false }: { sidebar?: boolean }) {
  return (
    <Button
      className={sidebar ? "sidebar-search" : undefined}
      type="button"
      variant="outline"
      size="sm"
      data-open-search
      aria-label="Search the docs"
    >
      <Search data-icon="inline-start" />
      <span>{sidebar ? "Search the docs" : "Search"}</span>
      <kbd>⌘ K</kbd>
    </Button>
  );
}

function Screenshot({ shot, source }: { shot: (typeof screenshots)[number]; source?: string }) {
  return (
    <figure className="screenshot">
      <div className="screen-frame">
        {source ? (
          <a
            href={source}
            data-capture={shot.title}
            aria-label={`Enlarge ${shot.title} screenshot`}
          >
            <img src={source} alt={shot.description} loading="lazy" />
          </a>
        ) : (
          <div className="capture-slot">
            <ImageIcon aria-hidden="true" />
            <span>Screenshot pending</span>
          </div>
        )}
      </div>
      <figcaption>
        <strong>{shot.title}</strong>
        <span>{shot.description}</span>
      </figcaption>
    </figure>
  );
}

function Gallery({ sources }: { sources: Assets["screenshots"] }) {
  return (
    <section className="home-section gallery-section" id="home-screenshots">
      <div className="wrap">
        <div className="section-heading">
          <div>
            <h2>See Nahhasio in use</h2>
            <p>Browse the desktop interface or see how it fits a narrow window.</p>
          </div>
          <div className="gallery-switch" role="group" aria-label="Screenshot layout">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              data-show-captures="desktop"
              aria-pressed="true"
              aria-controls="desktop-captures"
            >
              <Monitor data-icon="inline-start" />
              Desktop
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              data-show-captures="mobile"
              aria-pressed="false"
              aria-controls="mobile-captures"
            >
              <Smartphone data-icon="inline-start" />
              Phone width
            </Button>
          </div>
        </div>
        {["desktop", "mobile"].map((mode) => (
          <div
            key={mode}
            id={`${mode}-captures`}
            className={`capture-grid capture-grid-${mode}`}
            data-capture-panel={mode}
            hidden={mode !== "desktop"}
          >
            {screenshots
              .filter((shot) => shot.id.startsWith(`${mode}-`))
              .map((shot) => (
                <Screenshot key={shot.id} shot={shot} source={sources[shot.id]} />
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureOverview() {
  return (
    <div className="feature-grid">
      {groups.map((group) => (
        <Card key={group.id} className="overview-card">
          <CardHeader>
            <group.icon className="group-icon" aria-hidden="true" />
            <CardTitle>{group.label}</CardTitle>
            <CardDescription>{group.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul>
              {group.items.slice(0, 3).map((item) => (
                <li key={item.title}>{item.title}</li>
              ))}
            </ul>
          </CardContent>
          <div className="card-link">
            <a href={`#features/${group.id}`}>
              Explore{" "}
              {group.id === "watch"
                ? "playback"
                : group.id === "family"
                  ? "watch tracking"
                  : group.id === "catalog"
                    ? "the catalog"
                    : "curation"}
              <ChevronRight aria-hidden="true" />
            </a>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Header({ mark }: { mark: string }) {
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <a className="brand" href="#home">
          <img src={mark} width="31" height="31" alt="" />
          <span>Nahhasio</span>
        </a>
        <nav aria-label="Main navigation">
          {navigation.map(([id, label]) => (
            <a key={id} href={`#${id}`} data-nav={id}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <SearchButton />
          <a
            href="#docs"
            data-nav="docs"
            className={buttonVariants({ size: "sm", variant: "secondary" })}
          >
            <BookOpen data-icon="inline-start" />
            Docs
          </a>
        </div>
      </div>
    </header>
  );
}

function Docs({ guides }: { guides: Entry[] }) {
  return (
    <main data-page="docs" hidden>
      <div className="docs-layout">
        <aside className="docs-sidebar">
          <div className="sidebar-heading">
            <BookOpen aria-hidden="true" /> Documentation
          </div>
          <SearchButton sidebar />
          <nav className="docs-nav" aria-label="Documentation">
            {topicGroups.map((group) => (
              <div className="docs-group" key={group}>
                <p>{group}</p>
                {topics
                  .filter((topic) => topic.group === group)
                  .map((topic) => (
                    <a href={`#docs/${topic.id}`} data-topic={topic.id} key={topic.id}>
                      <topic.icon aria-hidden="true" />
                      {topic.label}
                    </a>
                  ))}
              </div>
            ))}
          </nav>
        </aside>
        <div className="article-area">
          {topics.map((topic, index) => {
            const entry = guides.find((guide) => guide.id === topic.id);
            if (!entry) throw new Error(`Missing guide ${topic.id}`);
            const next = topics[index + 1];
            const previous = topics[index - 1];
            return (
              <div
                className="doc-page"
                key={entry.id}
                data-guide={entry.id}
                hidden={entry.id !== "start"}
              >
                <div className="article-breadcrumb">
                  <a href="#docs">Docs</a>
                  <ChevronRight aria-hidden="true" />
                  <span>{topic.group}</span>
                </div>
                <header className="article-title">
                  <h1>{entry.title}</h1>
                  <p>{topic.desc}</p>
                </header>
                {entry.id === "start" && (
                  <div className="docs-start">
                    <div className="docs-notice">
                      <CircleHelp aria-hidden="true" />
                      <p>
                        Nahhasio brings together a catalog, viewing progress, and media you supply
                        for your household.
                      </p>
                    </div>
                    <h2>Choose a guide</h2>
                    <div className="start-grid">
                      {topics
                        .filter((item) => starterTopics.has(item.id))
                        .map((item) => (
                          <Card size="sm" key={item.id}>
                            <CardHeader>
                              <item.icon aria-hidden="true" />
                              <CardTitle>
                                <a href={`#docs/${item.id}`}>{item.label}</a>
                              </CardTitle>
                              <CardDescription>{item.desc}</CardDescription>
                            </CardHeader>
                          </Card>
                        ))}
                    </div>
                  </div>
                )}
                <article className="prose" dangerouslySetInnerHTML={{ __html: entry.html }} />
                <nav className="article-pager" aria-label="Adjacent guides">
                  {previous && (
                    <a href={`#docs/${previous.id}`}>
                      <span>Previous guide</span>
                      <strong>{previous.label}</strong>
                    </a>
                  )}
                  {next && (
                    <a href={`#docs/${next.id}`}>
                      <span>Next guide</span>
                      <strong>{next.label}</strong>
                    </a>
                  )}
                </nav>
              </div>
            );
          })}
        </div>
        <aside className="docs-toc" aria-label="On this page">
          <strong>On this page</strong>
          {guides.map((entry) => (
            <nav key={entry.id} data-outline={entry.id} hidden={entry.id !== "start"}>
              {entry.headings.map((heading) => (
                <a key={heading.id} href={`#docs/${entry.id}/${heading.id}`}>
                  {heading.title}
                </a>
              ))}
            </nav>
          ))}
        </aside>
      </div>
    </main>
  );
}

export function Site({
  guides,
  changes,
  assets,
}: {
  guides: Entry[];
  changes: Entry[];
  assets: Assets;
}) {
  const heroCapture = assets.screenshots["desktop-browse"] ?? assets.screenshots["desktop-home"];
  return (
    <div id="nahhasio-review">
      <Header mark={assets.mark} />
      <main data-page="home">
        <section className="hero">
          <div className="wrap hero-inner">
            <div className="hero-copy">
              <h1>
                Your family’s
                <br /> media library.
              </h1>
              <p>
                An Arabic-first catalog, watch tracker, and media player for your household’s
                collection.
              </p>
              <div className="actions">
                <Action href="#home/screenshots">
                  <LayoutGrid data-icon="inline-start" />
                  See the interface
                </Action>
                <Action href="#docs" secondary>
                  Read the docs
                </Action>
              </div>
              <div className="hero-meta">
                <Film aria-hidden="true" />
                <span>Films, series, and Arabic dubs</span>
              </div>
            </div>
            {heroCapture ? (
              <figure className="hero-capture">
                <img src={heroCapture} alt="Nahhasio desktop library" fetchPriority="high" />
              </figure>
            ) : (
              <div className="hero-mark" aria-hidden="true">
                <div className="mark-grid" />
                <div className="mark-orbit" />
                <img src={assets.mark} width="190" height="190" alt="" />
              </div>
            )}
          </div>
        </section>

        <div className="feature-strip">
          <div className="wrap">
            <a href="#features/catalog">
              <strong>Arabic-first catalog</strong>
              <span>Find works by the names you know.</span>
            </a>
            <a href="#features/family">
              <strong>Separate watch histories</strong>
              <span>Everyone can pick up where they left off.</span>
            </a>
            <a href="#features/watch">
              <strong>Videos you can keep</strong>
              <span>Play your collection or save video for offline.</span>
            </a>
          </div>
        </div>

        <Gallery sources={assets.screenshots} />

        <section className="wrap home-section" id="home-features">
          <div className="section-heading">
            <div>
              <h2>What you can do</h2>
              <p>From finding an Arabic dub to organizing your own video files.</p>
            </div>
            <a href="#features">
              All features <ChevronRight aria-hidden="true" />
            </a>
          </div>
          <FeatureOverview />
        </section>

        <section className="wrap home-section home-end">
          <div className="about-section">
            <h2>A personal project</h2>
            <p>
              I built Nahhasio for my family, especially for the Arabic dubs we grew up with. I
              relied heavily on Claude Opus 5 and GPT 6 Sol during development.
            </p>
            <p>
              The project shares the software. Each household supplies its own catalog and videos.
            </p>
          </div>
          <div className="next-links">
            <a href="#docs">
              <BookOpen aria-hidden="true" />
              <div>
                <strong>Documentation</strong>
                <span>Find a guide for what you want to do.</span>
              </div>
              <ChevronRight aria-hidden="true" />
            </a>
            <a href="#changelog">
              <ListVideo aria-hidden="true" />
              <div>
                <strong>Changelog</strong>
                <span>See what changed in Nahhasio.</span>
              </div>
              <ChevronRight aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <main data-page="features" hidden>
        <div className="wrap subpage">
          <div className="page-intro">
            <h1>Features</h1>
            <p>Browse Nahhasio’s full set of catalog, viewing, and collection tools.</p>
          </div>
          <nav className="section-nav" aria-label="Feature categories">
            {groups.map((group) => (
              <a key={group.id} href={`#features/${group.id}`}>
                {group.label}
              </a>
            ))}
          </nav>
          {groups.map((group) => (
            <section className="feature-section" key={group.id} id={`features-${group.id}`}>
              <header>
                <group.icon aria-hidden="true" />
                <h2>{group.label}</h2>
                <p>{group.summary}</p>
              </header>
              <dl>
                {group.items.map((item) => (
                  <div key={item.title}>
                    <dt>
                      <a href={`#docs/${item.guide}`}>{item.title}</a>
                    </dt>
                    <dd>{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </main>

      <Docs guides={guides} />

      <main data-page="changelog" hidden>
        <div className="wrap subpage change-page">
          <div className="page-intro">
            <h1>Changelog</h1>
            <p>Changes to the catalog, watching experience, and collection tools.</p>
          </div>
          {changes.map((entry, index) => (
            <section className="change-entry" key={entry.id}>
              <div className="version">
                <Badge variant="outline">{entry.id}</Badge>
                {index === 0 && <span>Development notes</span>}
              </div>
              <div>
                <h2>{entry.title}</h2>
                <div className="prose" dangerouslySetInnerHTML={{ __html: entry.html }} />
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <a className="brand" href="#home">
            <img src={assets.mark} width="25" height="25" alt="" />
            Nahhasio
          </a>
          <nav aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#docs">Docs</a>
            <a href="#changelog">Changelog</a>
          </nav>
        </div>
      </footer>
      <dialog className="capture-dialog" aria-labelledby="capture-dialog-title">
        <div className="dialog-header">
          <h2 id="capture-dialog-title">Screenshot</h2>
          <form method="dialog">
            <Button variant="ghost" size="icon" aria-label="Close screenshot">
              <X />
            </Button>
          </form>
        </div>
        <img alt="" data-enlarged-capture />
      </dialog>
      <dialog className="search-dialog" aria-labelledby="review-search-title">
        <div className="dialog-header">
          <h2 id="review-search-title">Search the docs</h2>
          <form method="dialog">
            <Button variant="ghost" size="icon" aria-label="Close search">
              <X />
            </Button>
          </form>
        </div>
        <Input
          type="search"
          placeholder="Try offline or Arabic"
          aria-label="Search documentation"
          autoComplete="off"
        />
        <p className="search-status" role="status"></p>
        <ul className="search-results">
          {topics.map((topic) => {
            const entry = guides.find((guide) => guide.id === topic.id);
            return (
              <li
                key={topic.id}
                data-text={`${topic.label} ${topic.desc} ${entry?.text ?? ""}`.toLowerCase()}
              >
                <a href={`#docs/${topic.id}`}>
                  <topic.icon aria-hidden="true" />
                  {topic.label}
                  <ChevronRight aria-hidden="true" />
                </a>
              </li>
            );
          })}
        </ul>
      </dialog>
    </div>
  );
}
