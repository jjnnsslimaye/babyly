type LikeUpdate = {
  listingId: string;
  listingType: 'listing' | 'buy_nothing';
  isLiked: boolean;
  likeCount: number;
};

let pendingUpdate: LikeUpdate | null = null;

export function setLikeUpdate(update: LikeUpdate) {
  pendingUpdate = update;
}

export function consumeLikeUpdate(): LikeUpdate | null {
  const update = pendingUpdate;
  pendingUpdate = null;
  return update;
}
