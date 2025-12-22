const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export const portfolioPages = [
  [
    { name: 'Rattlesnake', folder: 'rattlesnake', path: `${base}/images/rattlesnake/rattlesnake_grayscale.png` },
    { name: 'Heart', folder: 'heart', path: `${base}/images/heart/heart.png` },
    { name: 'Hisham', folder: 'hisham', path: `${base}/images/hisham/hisham.jpg` },
    { name: 'Joshua Tree', folder: 'joshua-tree', path: `${base}/images/joshua-tree/joshua-tree.png` },
  ],
  [
    { name: 'Bookshelf', folder: 'bookshelf', path: `${base}/images/bookshelf/bookshelf.png` },
    { name: 'Ana Marie Cauce', folder: 'cauce', path: `${base}/images/cauce/cauce.png` },
    { name: 'Goose', folder: 'goose', path: `${base}/images/goose/goose.png` },
    { name: 'Dallas', folder: 'dallas', path: `${base}/images/dallas/dallas_grayscale.png` },
  ],
];