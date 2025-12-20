import { useState } from "react";
import npyjs from "npyjs";
import Menu from "./components/Menu";
import Loading from "./components/Loading";
import Visualization from "./components/Visualization";
import ndarray from "ndarray";

function App() {
  const [pageNum, setPageNum] = useState(1);
  const [matrices, setMatrices] = useState(null);
  const BLOCK = 20;

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

  function addRank1InPlace(out, US, Vt, i, m, n) {
    const USdata = US.data;     // ndarray-backed Float32Array
    const VtData = Vt.data;    // raw Float32Array
    const r = US.shape[1];     // rank dimension

    for (let row = 0; row < m; row++) {
      const u = USdata[row * r + i];
      const rowOffset = row * n;
      const vtOffset = i * n;

      for (let col = 0; col < n; col++) {
        out[rowOffset + col] += u * VtData[vtOffset + col];
      }
    }
  }

  function buildCheckpoints(US, Vt, S, m, n) {
    const checkpoints = [];
    let current = new Float32Array(m * n);

    checkpoints.push(current.slice()); // k = 0

    for (let i = 0; i < S.data.length; i++) {
      addRank1InPlace(current, US, Vt, i, m, n);

      if ((i + 1) % BLOCK === 0) {
        checkpoints.push(current.slice());
      }
    }

    return checkpoints;
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
    const np = new npyjs();
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
        await np.load(`${baseUrl}/U1.npy`);
        isColor = true;
      } catch (e) {
        isColor = false;
      }

      if (isColor) {
        for (let c of [1, 2, 3]) {
          const U = await np.load(`${baseUrl}/U${c}.npy`);
          const S = await np.load(`${baseUrl}/S${c}.npy`);
          const Vt = await np.load(`${baseUrl}/Vt${c}.npy`);

          const US = computeUS(U, S);
          const m = US.shape[0];
          const n = Vt.shape[1];

          loadedData[`US${c}`] = US;
          loadedData[`Vt${c}`] = Vt;
          loadedData[`S${c}`] = S;

          loadedData[`checkpoints${c}`] = buildCheckpoints(
            US,
            Vt,
            S,
            m,
            n
          );
        }

        loadedData.isColor = true;
      } else {
        // 2. Grayscale Fallback
        const U = await np.load(`${baseUrl}/U.npy`);
        const S = await np.load(`${baseUrl}/S.npy`);
        const Vt = await np.load(`${baseUrl}/Vt.npy`);

        const US = computeUS(U, S);
        const m = US.shape[0];
        const n = Vt.shape[1];

        loadedData.US = US;
        loadedData.Vt = Vt;
        loadedData.S = S;

        loadedData.checkpoints = buildCheckpoints(
          US,
          Vt,
          S,
          m,
          n
        );
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