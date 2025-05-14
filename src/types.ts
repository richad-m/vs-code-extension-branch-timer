export type GitApi = {
  repositories: {
    state?: {
      onDidChange: (callback: () => void) => void;
      HEAD?: {
        name: string;
      };
    };
  }[];
};
