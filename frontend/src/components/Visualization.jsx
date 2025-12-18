import React, { useState, useEffect, useRef } from 'react';
import ndarray from 'ndarray';
import gemm from 'ndarray-gemm';

export default function Visualization({ data }) {
  const [k, setK] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef(null);

  // Determine dimensions and max K
  // data.S is the singular value vector
  const maxK = data.isColor ? data.S1.shape[0] : data.S.shape[0];
  const rows = data.isColor ? data.U1.shape[0] : data.U.shape[0];
  const cols = data.isColor ? data.Vt1.shape[1] : data.Vt.shape[1];

  const reconstructChannel = (U, S, Vt, k, m, n) => {
    // Create ndarrays from the flat TypedArrays
    const uNd = ndarray(U.data, [m, U.shape[1]]);
    const sNd = S.data; // This is a flat vector of singular values
    const vtNd = ndarray(Vt.data, [Vt.shape[0], n]);

    // Result matrix A_k = (U_k * S_k) * Vt_k
    const result = ndarray(new Float32Array(m * n), [m, n]);

    // Intermediate: U_k scaled by S_k
    const usKey = ndarray(new Float32Array(m * k), [m, k]);
    for (let j = 0; j < k; j++) {
      for (let i = 0; i < m; i++) {
        usKey.set(i, j, uNd.get(i, j) * sNd[j]);
      }
    }

    // Multiply (US) * Vt
    // We only take the first k rows of Vt
    const vt_k = vtNd.hi(k, n);
    gemm(result, usKey, vt_k);

    return result.data; // Return the reconstructed pixels
  };

  const renderApproximation = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(cols, rows);

    if (data.isColor) {
      const rChannel = reconstructChannel(data.U1, data.S1, data.Vt1, k, rows, cols);
      const gChannel = reconstructChannel(data.U2, data.S2, data.Vt2, k, rows, cols);
      const bChannel = reconstructChannel(data.U3, data.S3, data.Vt3, k, rows, cols);

      for (let i = 0; i < rows * cols; i++) {
        imageData.data[i * 4] = rChannel[i];     // R
        imageData.data[i * 4 + 1] = gChannel[i]; // G
        imageData.data[i * 4 + 2] = bChannel[i]; // B
        imageData.data[i * 4 + 3] = 255;         // A
      }
    } else {
      const gray = reconstructChannel(data.U, data.S, data.Vt, k, rows, cols);
      for (let i = 0; i < rows * cols; i++) {
        const val = gray[i];
        imageData.data[i * 4] = val;
        imageData.data[i * 4 + 1] = val;
        imageData.data[i * 4 + 2] = val;
        imageData.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    if (!isHovered) {
      renderApproximation();
    }
  }, [k, isHovered]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f3ef] p-8">
      <div
        className="relative shadow-2xl rounded-lg overflow-hidden bg-white"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isHovered ? (
            /* Show actual image on hover */
          <img
            src={data.originalPath}
            alt="Original"
            style={{ width: cols, height: rows }}
            className="block"
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={cols}
            height={rows}
            className="block"
          />
        )}
      </div>

      <div className="w-full max-w-xl mt-12 space-y-4">
        <div className="flex justify-between font-[lilex] text-gray-600">
          <span>Rank (k): {k}</span>
          <span>Max Rank: {maxK}</span>
        </div>
        <input
          type="range"
          min="1"
          max={maxK}
          value={k}
          onChange={(e) => setK(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-sky-600"
        />
        <p className="text-center text-sm text-gray-500 font-light">
          {isHovered ? "Viewing Original Image" : "Slide to adjust singular values"}
        </p>
      </div>
    </div>
  );
}