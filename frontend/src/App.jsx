import { useState } from "react";
import npyjs from "npyjs";
import Menu from "./Menu";
import Loading from "./Loading";
import Visualization from "./Visualization";

function App() {
  const [pageNum, setPageNum] = useState(1);
  const [matrices, setMatrices] = useState(null);

  async function handleSelectTemplate(imageFolder) {
    setPageNum(2); // Switch to Loading screen
    const n = new npyjs();

    try {
      // Check for color vs BW by attempting to load U1.npy
      // If U1 exists, we assume it's a color image (3 channels)
      // Otherwise, we fall back to the single U.npy
      let loadedData = {};

      try {
        // Attempt Color Load
        const paths = ['U', 'S', 'Vt'];
        const channels = [1, 2, 3];

        for (let c of channels) {
          for (let p of paths) {
            const fileName = `${p}${c}.npy`;
            const res = await n.load(`images/${imageFolder}/${fileName}`);
            loadedData[`${p}${c}`] = res;
          }
        }
        loadedData.isColor = true;
      } catch (e) {
        // Fallback to Black and White
        const paths = ['U', 'S', 'Vt'];
        for (let p of paths) {
          const res = await n.load(`images/${imageFolder}/${p}.npy`);
          loadedData[p] = res;
        }
        loadedData.isColor = false;
      }

      setMatrices(loadedData);
      setPageNum(3); // Switch to Visualization
    } catch (err) {
      console.error("Failed to load matrices:", err);
      setPageNum(1); // Return to menu on error
    }
  }

  return (
    <>
      {pageNum === 1 && <Menu onSelect={handleSelectTemplate} />}
      {pageNum === 2 && <Loading />}
      {pageNum === 3 && <Visualization data={matrices} />}
    </>
  );
}

export default App;