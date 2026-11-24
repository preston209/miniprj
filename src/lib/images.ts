export const GENERATED_IMAGES = {
  heroLounge: '/src/assets/images/havenstay_hero_lounge_1795435461346.jpg',
  singleRoom: '/src/assets/images/room_single_studio_1795435463380.jpg',
  doubleRoom: '/src/assets/images/room_double_suite_1795435461509.jpg',
  tripleRoom: '/src/assets/images/room_triple_loft_1795435461316.jpg',
} as const;

export function resolveRoomImage(
  sharingType: 'single' | 'double' | 'triple',
  imageUrl?: string
): string {
  if (imageUrl && imageUrl.startsWith('/src/assets/images/')) {
    return imageUrl;
  }
  if (sharingType === 'single') return GENERATED_IMAGES.singleRoom;
  if (sharingType === 'double') return GENERATED_IMAGES.doubleRoom;
  return GENERATED_IMAGES.tripleRoom;
}
