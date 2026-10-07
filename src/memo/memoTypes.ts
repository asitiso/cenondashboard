export type MemoColor = "yellow" | "blue" | "green" | "pink" | "purple" | "gray";

export interface MemoCheckItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Memo {
  id: string;
  title: string;
  body: string;
  checklist: MemoCheckItem[];
  color: MemoColor;
  pinned: boolean;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export type MemoInput = Pick<Memo, "title" | "body" | "checklist" | "color" | "pinned">;
