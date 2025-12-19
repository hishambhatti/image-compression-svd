import { useState } from "react";
import npyjs from "npyjs";
import Menu from "./components/Menu";
import Loading from "./components/Loading";
import Visualization from "./components/Visualization";

function App() {
  const [pageNum, setPageNum] = useState(1);
  const [matrices, setMatrices] = useState(null);

  // For the file input onChange:
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const tempUrl = URL.createObjectURL(file);
      const mockImageObject = {
        folder: 'user-upload', // You'd need a way to process SVD on the fly for this
        path: tempUrl
      };
      handleSelectTemplate(mockImageObject);
    }
  };

  async function handleSelectTemplate(selectedImg) {
    setPageNum(2); // Switch to Loading screen
    const n = new npyjs();
    const folder = selectedImg.folder;

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
            loadedData[`${p}${c}`] = await n.load(`images/${folder}/${fileName}`);
          }
        }
        console.log("color");
        loadedData.isColor = true;
      } catch (e) {
        // Fallback to Black and White
        const paths = ['U', 'S', 'Vt'];
        for (let p of paths) {
          loadedData[p] = await n.load(`images/${folder}/${p}.npy`);
        }
        console.log("bw");
        console.log(loadedData['S'])
        loadedData.isColor = false;
      }

      // Attach the original path from the portfolio object
      loadedData.originalPath = selectedImg.path;
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