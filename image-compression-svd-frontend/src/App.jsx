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
  const [loadingInfo, setLoadingInfo] = useState(null);
  const BLOCK = 25;

  function onBack() {
    setPageNum(1);
  }

  const MAX_PIXELS = 1080 * 1080;

  function loadImageToMatrix(file) {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        const originalWidth = img.width;
        const originalHeight = img.height;

        let targetWidth = originalWidth;
        let targetHeight = originalHeight;
        let wasDownsampled = false;

        const totalPixels = originalWidth * originalHeight;

        if (totalPixels > MAX_PIXELS) {
          const scale = Math.sqrt(MAX_PIXELS / totalPixels);
          targetWidth = Math.floor(originalWidth * scale);
          targetHeight = Math.floor(originalHeight * scale);
          wasDownsampled = true;
        }

        console.log(
          `Image: ${originalWidth}×${originalHeight} → ${targetWidth}×${targetHeight}`,
          wasDownsampled ? "(downsampled)" : "(original)"
        );

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const { data } = ctx.getImageData(0, 0, targetWidth, targetHeight);

        resolve({
          data,
          width: targetWidth,
          height: targetHeight,
          originalWidth,
          originalHeight,
          wasDownsampled,
        });
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

    console.log("Color: " + isColor)

    return { gray, r, g, b, width, height, isColor };
  }

  async function handleUserUpload(file) {
    setPageNum(2);
    const lastDotIndex = file.name.lastIndexOf('.');
    const name = file.name.substring(0, lastDotIndex)
    const img = await loadImageToMatrix(file);

    setLoadingInfo({
      wasDownsampled: img.wasDownsampled,
      originalWidth: img.originalWidth,
      originalHeight: img.originalHeight,
      finalWidth: img.width,
      finalHeight: img.height,
    });

    const { gray, r, g, b, width, height, isColor } = extractChannels(img);

    // Initialize Worker (Vite syntax)
    const worker = new Worker(new URL('./svd.worker.js', import.meta.url), {
      type: 'module'
    });

    // Send data to worker
    worker.postMessage({
      channels: isColor ? [r, g, b] : [gray],
      width,
      height,
      isColor
    });

    // Listen for the result
    worker.onmessage = (e) => {
      const workerData = e.data;
      let loadedData = {
        isColor,
        downsampled: img.wasDownsampled,
        originalWidth: img.originalWidth,
        originalHeight: img.originalHeight,
        finalWidth: width,
        finalHeight: height,
        originalPath: URL.createObjectURL(file),
        name: name
      };

      // Reconstruct ndarrays and build checkpoints
      if (isColor) {
        for (let c = 1; c <= 3; c++) {
          const U = ndarray(new Float32Array(workerData[`U${c}`]), [height, workerData[`S${c}`].length]);
          const S = ndarray(new Float32Array(workerData[`S${c}`]), [workerData[`S${c}`].length]);
          const Vt = ndarray(new Float32Array(workerData[`Vt${c}`]), [workerData[`S${c}`].length, width]);

          const US = computeUS(U, S);
          loadedData[`US${c}`] = US;
          loadedData[`S${c}`] = S;
          loadedData[`Vt${c}`] = Vt;
          loadedData[`checkpoints${c}`] = buildCheckpoints(US, Vt, S, height, width);
        }
      } else {
        const U = ndarray(new Float32Array(workerData.U), [height, workerData.S.length]);
        const S = ndarray(new Float32Array(workerData.S), [workerData.S.length]);
        const Vt = ndarray(new Float32Array(workerData.Vt), [workerData.S.length, width]);

        const US = computeUS(U, S);
        loadedData.US = US;
        loadedData.S = S;
        loadedData.Vt = Vt;
        loadedData.checkpoints = buildCheckpoints(US, Vt, S, height, width);
      }

      setMatrices(loadedData);
      setLoadingInfo(null);
      setPageNum(3);
      worker.terminate(); // Clean up the worker
    };
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
      loadedData.name = selectedImg.name.toLowerCase();
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
      {pageNum === 2 && <Loading info={loadingInfo} />}
      {pageNum === 3 && <Visualization data={matrices} onBack={onBack} handleUpload={handleUpload}/>}
    </>
  );
}

export default App;