export type ProjectTech = {
  category: string;
  name: string;
  reason: string;
};

export type ProjectComponent = {
  name: string;
  purpose: string;
};

export type ProjectPlan = {
  name: string;
  tagline: string;
  summary: string;
  goals: string[];
  features: string[];
  techStack: ProjectTech[];
  components: ProjectComponent[];
  milestones: string[];
};
