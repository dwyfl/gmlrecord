export const ASPECT_RATIOS = {
  '16:9': { x: 1920, y: 1080 },
  '4:3': { x: 1024, y: 768 },
  '1:1': { x: 1000, y: 1000 },
  '1:√2': { x: 1 * 1000, y: Math.round(Math.sqrt(2) * 1000) },
};

export default {
  ASPECT_RATIOS,
};
