export type BuilderFilePath = "index.html" | "styles.css" | "app.js";
export type BuilderFileLanguage = "html" | "css" | "javascript";

export type BuilderFile = {
  path: BuilderFilePath;
  language: BuilderFileLanguage;
  content: string;
};

export type BuilderVersion = {
  id: string;
  projectId: string;
  userId: number;
  instruction: string | null;
  origin: "generate" | "restore";
  files: BuilderFile[];
  createdAt: Date;
};
