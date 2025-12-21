import { useState } from "react";
import npyjs from "npyjs";
import Menu from "./components/Menu";
import Loading from "./components/Loading";
import Visualization from "./components/Visualization";
import ndarray from "ndarray";
import { SVD } from "svd-js";

function App() {
  const [pageNum, setPageNum] = useState(1);
  const [matrices, setMatrices] = useState(null);
  const BLOCK = 20;

  function onBack() {
    setPageNum(1);
  }

  function loadImageToMatrix(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.drawImage(img, 0, 0);

        const { data } = ctx.getImageData(0, 0, img.width, img.height);
        resolve({ data, width: img.width, height: img.height });
      };
      img.src = URL.createObjectURL(file);
    });
  }

  function extractChannels({ data, width, height }) {
    const gray = new Float32Array(width * height);
    const r = new Float32Array(width * height);
    const g = new Float32Array(width * height);
    const b = new Float32Array(width * height);

    let isColor = false;

    for (let i = 0; i < width * height; i++) {
      const R = data[i * 4] / 255;
      const G = data[i * 4 + 1] / 255;
      const B = data[i * 4 + 2] / 255;

      const A = data[i*4 + 3] / 255; // alpha in [0,1]
      r[i] = R * A + (1 - A); // blend with white background
      g[i] = G * A + (1 - A);
      b[i] = B * A + (1 - A);
      gray[i] = (r[i] + g[i] + b[i]) / 3;

      if (R !== G || G !== B) isColor = true;
    }

    console.log(isColor)

    return { gray, r, g, b, width, height, isColor };
  }

  function computeSVDFromChannel(channel, m, n) {
    let matrix = new Array(m);
    for (let i = 0; i < m; i++) {
      matrix[i] = Array.from(channel.slice(i * n, (i + 1) * n));
    }

    let transposed = false;
    if (m < n) {
      const temp = new Array(n);
      for (let i = 0; i < n; i++) {
        temp[i] = new Array(m);
        for (let j = 0; j < m; j++) temp[i][j] = matrix[j][i];
      }
      matrix = temp;
      transposed = true;
    }

    const { u, q, v } = SVD(matrix);

    // SORTING STEP
    // q = singular values, u = left vectors, v = right vectors
    const sortedIndices = q.map((val, idx) => idx)
                          .sort((a, b) => q[b] - q[a]); // descending

    const qSorted = sortedIndices.map(i => q[i]);
    const uSorted = u.map(row => sortedIndices.map(i => row[i]));
    const vSorted = v.map(row => sortedIndices.map(i => row[i]));

    let U, S, Vt;

    if (!transposed) {
      const r = qSorted.length;
      U = ndarray(new Float32Array(uSorted.flat()), [m, r]);
      S = ndarray(new Float32Array(qSorted), [r]);
      const VtData = new Float32Array(r * n);
      for (let i = 0; i < r; i++)
        for (let j = 0; j < n; j++)
          VtData[i * n + j] = vSorted[j][i];
      Vt = ndarray(VtData, [r, n]);
    } else {
      const r = qSorted.length;
      U = ndarray(new Float32Array(vSorted.flat()), [m, r]);
      S = ndarray(new Float32Array(qSorted), [r]);
      const VtData = new Float32Array(r * n);
      for (let i = 0; i < r; i++)
        for (let j = 0; j < n; j++)
          VtData[i * n + j] = uSorted[j][i];
      Vt = ndarray(VtData, [r, n]);
    }

    return { U, S, Vt };
  }

  async function handleUserUpload(file) {
    setPageNum(2);

    const img = await loadImageToMatrix(file);
    const { gray, r, g, b, width, height, isColor } = extractChannels(img);

    let loadedData = { isColor };

    if (isColor) {
      const ch = [r, g, b];
      for (let c = 0; c < 3; c++) {
        const { U, S, Vt } = computeSVDFromChannel(ch[c], height, width);
        const US = computeUS(U, S);

        loadedData[`US${c + 1}`] = US;
        loadedData[`S${c + 1}`] = S;
        loadedData[`Vt${c + 1}`] = Vt;
        loadedData[`checkpoints${c + 1}`] =
          buildCheckpoints(US, Vt, S, height, width);
      }
    } else {
      const { U, S, Vt } = computeSVDFromChannel(gray, height, width);
      const US = computeUS(U, S);

      loadedData.US = US;
      loadedData.S = S;
      loadedData.Vt = Vt;
      loadedData.checkpoints =
        buildCheckpoints(US, Vt, S, height, width);
    }

    loadedData.originalPath = URL.createObjectURL(file);
    setMatrices(loadedData);
    setPageNum(3);
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
      handleUserUpload(file)
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
      {pageNum === 1 && <Menu onSelect={handleSelectTemplate} handleUpload={handleUpload}/>}
      {pageNum === 2 && <Loading />}
      {pageNum === 3 && <Visualization data={matrices} onBack={onBack}/>}
    </>
  );
}

export default App;