type LikeUpdate = {
  listingId: string;
  listingType: 'listing' | 'buy_nothing';
  isLiked: boolean;
  likeCount: number;
};

const pendingUpdates = new Map<string, LikeUpdate>();

export function setLikeUpdate(update: LikeUpdate) {
  // Keyed by listingId so repeated like/unlike on the same item collapses
  // to just the latest state.
  pendingUpdates.set(update.listingId, update);
}

export function consumeLikeUpdate(): LikeUpdate | null {
  const first = pendingUpdates.values().next();
  if (first.done) return null;
  pendingUpdates.delete(first.value.listingId);
  return first.value;
}

export function consumeLikeUpdates(
  listingType?: 'listing' | 'buy_nothing'
): LikeUpdate[] {
  if (!listingType) {
    const updates = Array.from(pendingUpdates.values());
    pendingUpdates.clear();
    return updates;
  }
  const updates = Array.from(pendingUpdates.values()).filter(
    (u) => u.listingType === listingType
  );
  updates.forEach((u) => pendingUpdates.delete(u.listingId));
  return updates;
}
