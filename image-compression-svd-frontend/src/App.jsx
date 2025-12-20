import { useState } from "react";
import npyjs from "npyjs";
import Menu from "./components/Menu";
import Loading from "./components/Loading";
import Visualization from "./components/Visualization";
import ndarray from "ndarray";

function App() {
  const [pageNum, setPageNum] = useState(1);
  const [matrices, setMatrices] = useState(null);

  function onBack() {
    setPageNum(1);
  }

  function computeUS(U, S) {
    const m = U.shape[0];
    const r = U.shape[1];

    const uNd = ndarray(U.data, [m, r]);
    const US = new Float32Array(m * r);

    for (let j = 0; j < r; j++) {
      const sigma = S.data[j];
      for (let i = 0; i < m; i++) {
        US[i * r + j] = uNd.get(i, j) * sigma;
      }
    }

    return ndarray(US, [m, r]);
  }

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
        for (let c of [1, 2, 3]) {
          const U = await n.load(`${baseUrl}/U${c}.npy`);
          const S = await n.load(`${baseUrl}/S${c}.npy`);
          const Vt = await n.load(`${baseUrl}/Vt${c}.npy`);

          loadedData[`US${c}`] = computeUS(U, S);
          loadedData[`Vt${c}`] = Vt;
          loadedData[`S${c}`] = S; // still needed for charts + stats
        }

        loadedData.isColor = true;
      } else {
        // 2. Grayscale Fallback
        const U = await n.load(`${baseUrl}/U.npy`);
        const S = await n.load(`${baseUrl}/S.npy`);
        const Vt = await n.load(`${baseUrl}/Vt.npy`);

        loadedData.US = computeUS(U, S);
        loadedData.S = S;
        loadedData.Vt = Vt;
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
      {pageNum === 3 && <Visualization data={matrices} onBack={onBack}/>}
    </>
  );
}

export default App;