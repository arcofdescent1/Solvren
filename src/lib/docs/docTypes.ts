export type DocFrontmatter = {
  title: string;
  description: string;
  section: string;
  order: number;
  toc?: boolean;
  icon?: string;
  tags?: string[];
  roles?: Array<"owner" | "admin" | "submitter" | "reviewer" | "viewer" | "executive">;
  lastUpdated?: string;
};

export type DocItem = {
  slug: string[];
  href: string;
  frontmatter: DocFrontmatter;
  rawContent: string;
  relativePath?: string;
};

export type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type DocsNavGroup = {
  section: string;
  items: Array<{
    title: string;
    href: string;
    description: string;
    order: number;
    tags?: string[];
  }>;
};

export type DocsSearchResult = {
  title: string;
  description: string;
  href: string;
  section: string;
  headings: string[];
  snippet: string;
  tags?: string[];
  roles?: string[];
};

export type DocsRoleShortcut = {
  role: "owner" | "admin" | "submitter" | "reviewer" | "viewer" | "executive";
  title: string;
  description: string;
  href: string;
};
