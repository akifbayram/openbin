export function getNoopShapeUrl(): string {
  return `/api/shapes/noop`;
}

export function getBinsShapeUrl(homeId: string): string {
  return `/api/shapes/bins?home_id=${encodeURIComponent(homeId)}`;
}

export function getPhotosShapeUrl(homeId: string): string {
  return `/api/shapes/photos?home_id=${encodeURIComponent(homeId)}`;
}

export function getHomeMembersShapeUrl(homeId: string): string {
  return `/api/shapes/home-members?home_id=${encodeURIComponent(homeId)}`;
}
