export type BuilderFilePath = string;
export type BuilderFileLanguage = "html" | "css" | "javascript";

const SAFE_BUILDER_FILE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,180}\.(?:html|css|js)$/;

export function isSafeBuilderFilePath(path: string): boolean {
  return SAFE_BUILDER_FILE_PATH.test(path);
}

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
