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
    setPageNum(2);
    const n = new npyjs();
    const folder = selectedImg.folder;

    // Use Vite's BASE_URL (which is "/image-compression-svd")
    // We ensure there are no double slashes by cleaning it up
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const baseUrl = `${base}/images/${folder}`;

    try {
      let loadedData = {};
      let isColor = false;

      // 1. Check for Color
      try {
        await n.load(`${baseUrl}/U1.npy`);
        isColor = true;
      } catch (e) {
        isColor = false;
      }

      if (isColor) {
        const paths = ['U', 'S', 'Vt'];
        for (let c of [1, 2, 3]) {
          for (let p of paths) {
            loadedData[`${p}${c}`] = await n.load(`${baseUrl}/${p}${c}.npy`);
          }
        }
        loadedData.isColor = true;
      } else {
        // 2. Grayscale Fallback
        loadedData['U'] = await n.load(`${baseUrl}/U.npy`);
        loadedData['S'] = await n.load(`${baseUrl}/S.npy`);
        loadedData['Vt'] = await n.load(`${baseUrl}/Vt.npy`);
        loadedData.isColor = false;
      }

      loadedData.originalPath = selectedImg.path;
      setMatrices(loadedData);
      setPageNum(3);
    } catch (err) {
      console.error("Critical Load Error:", err);
      setPageNum(1);
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