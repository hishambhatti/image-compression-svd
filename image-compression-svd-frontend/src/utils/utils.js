const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export const portfolioImages = [
  { name: 'Rattlesnake', folder: 'rattlesnake', path: `${base}/images/rattlesnake/rattlesnake_grayscale.png` },
  { name: 'Heart', folder: 'heart', path: `${base}/images/heart/heart.png` },
  { name: 'Hisham', folder: 'hisham', path: `${base}/images/hisham/hisham.jpg` },
  { name: 'Joshua Tree', folder: 'joshua-tree', path: `${base}/images/joshua-tree/joshua-tree.png` },
];