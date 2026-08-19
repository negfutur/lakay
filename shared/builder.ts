export type BuilderFilePath = "index.html" | "styles.css" | "data.js" | "state.js" | "components.js" | "app.js";
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
  summary: string | null;
  origin: "generate" | "restore" | "edit";
  files: BuilderFile[];
  createdAt: Date;
};
