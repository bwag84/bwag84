export type Verdict = "Class" | "Pass" | "Arse";
export type BuyAgain = "Yes" | "No";
export type WineStatus = "drunk" | "benchmark";

export interface OpenAIFileRef {
  name: string;
  id: string;
  mime_type: string;
  download_link: string;
}

export interface WineInput {
  title: string;
  date: string;
  producer: string;
  vintage: string;
  country: string;
  region: string;
  grapes: string[];
  rating: number;
  verdict: Verdict;
  wouldBuyAgain: BuyAgain;
  buyAgain: boolean;
  status: WineStatus;
  tags: string[];
}

export interface ReviewInput {
  firstImpression: string;
  whatINoticed: string;
  verdict: string;
  context: string | null;
}

export interface ValidatedCapture {
  captureId: string;
  wine: WineInput;
  review: ReviewInput;
  file: OpenAIFileRef | null;
}

export class AppError extends Error {
  public constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly publicMessage: string,
    options?: ErrorOptions,
  ) {
    super(publicMessage, options);
    this.name = "AppError";
  }
}
