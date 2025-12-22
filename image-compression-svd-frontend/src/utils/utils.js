const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export const portfolioPages = [
  [
    { name: 'Rattlesnake Ledge', folder: 'rattlesnake', path: `${base}/images/rattlesnake/rattlesnake_grayscale.png` },
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

// Formatter to handle 0 and 100 specifically
export const tooltipFormatter = (value, name, props) => {
  const displayName = name === "renderVal" ? "Value" : "Cumulative Sum";

  // Logic for specific values
  const actualValue = name === "renderVal" ? props.payload.trueVal : value;

  let displayValue;
  if (actualValue === 0) displayValue = "0";
  else if (actualValue === 100) displayValue = "100";
  else displayValue = actualValue.toFixed(5);

  return [displayValue, displayName];
};

export const BLOCK = 25;
export const MAX_PIXELS = 1080 * 1080;
export const FRAME_INTERVAL = 2; // 500 FPS