export type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  address: string;
  /** First/primary photo URL (for card thumbnail) */
  photoUrl?: string;
  /** All photo URLs (for detail view) */
  photoUrls: string[];
};
