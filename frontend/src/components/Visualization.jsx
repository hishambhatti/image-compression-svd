import React, { useState, useEffect, useRef, useMemo } from 'react';
import ndarray from 'ndarray';
import gemm from 'ndarray-gemm';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function Visualization({ data }) {
  const [k, setK] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const canvasRef = useRef(null);

  // 1. Data Parsing
  const S_vector = data.isColor ? data.S1.data : data.S.data;
  const maxK = S_vector.length;
  const rows = data.isColor ? data.U1.shape[0] : data.U.shape[0];
  const cols = data.isColor ? data.Vt1.shape[1] : data.Vt.shape[1];

  // 2. Prepare Graph Data (Matches Python: semilogy and cumsum/sum)
  const chartData = useMemo(() => {
    const EPS = 1e-5; // For log-scale rendering
    let runningSum = 0;
    const totalSum = Array.from(S_vector).reduce((a, b) => a + b, 0);

    // We map all values for the cumulative math, but can slice for display performance
    return Array.from(S_vector).map((val, i) => {
      runningSum += val;
      return {
        index: i + 1,
        // What the chart uses internally
        renderVal: val > 0 ? val : EPS, // Avoid 0 for log scale
        // What the user should see
        trueVal: val,
        cumulative: (runningSum / totalSum) * 100
      };
    }).slice(0, 150); // Show first 150 components for visual clarity
  }, [S_vector]);

  // Matrix Reconstruction (Keeping your existing logic)
  const reconstructChannel = (U, S, Vt, k, m, n) => {
    const uNd = ndarray(U.data, [m, U.shape[1]]);
    const sNd = S.data;
    const vtNd = ndarray(Vt.data, [Vt.shape[0], n]);
    const result = ndarray(new Float32Array(m * n), [m, n]);
    const usKey = ndarray(new Float32Array(m * k), [m, k]);
    for (let j = 0; j < k; j++) {
      for (let i = 0; i < m; i++) {
        usKey.set(i, j, uNd.get(i, j) * sNd[j]);
      }
    }
    const vt_k = vtNd.hi(k, n);
    gemm(result, usKey, vt_k);
    return result.data;
  };

  const renderApproximation = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(cols, rows);

    if (data.isColor) {
      const r = reconstructChannel(data.U1, data.S1, data.Vt1, k, rows, cols);
      const g = reconstructChannel(data.U2, data.S2, data.Vt2, k, rows, cols);
      const b = reconstructChannel(data.U3, data.S3, data.Vt3, k, rows, cols);
      for (let i = 0; i < rows * cols; i++) {
        imageData.data[i * 4] = r[i]; imageData.data[i * 4 + 1] = g[i];
        imageData.data[i * 4 + 2] = b[i]; imageData.data[i * 4 + 3] = 255;
      }
    } else {
      const gray = reconstructChannel(data.U, data.S, data.Vt, k, rows, cols);
      for (let i = 0; i < rows * cols; i++) {
        const v = gray[i];
        imageData.data[i * 4] = v; imageData.data[i * 4 + 1] = v;
        imageData.data[i * 4 + 2] = v; imageData.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    if (!isHovered) renderApproximation();
  }, [k, isHovered]);

  return (
    <div className='min-h-screen bg-[#f4f3ef] flex flex-col items-center py-6 px-4 font-[lilex]'>
      {/* Header */}
      <header className='w-full flex flex-col items-center text-center mb-8 mt-4 px-4'>
        <div className='flex items-center justify-center gap-10 w-full'>
          <img src="circle.png" alt="Circle" className="hidden md:block w-24 h-24 object-contain" />
          <div className="flex flex-col items-center shrink-0">
            <h1 className='text-4xl md:text-5xl lg:text-6xl font-light mb-0 font-[Vend_Sans]'>SVD Image Compression</h1>
            <div className='w-12 h-px bg-gray-400 my-4'></div>
          </div>
          <img src="ellipse.png" alt="Ellipse" className="hidden md:block w-24 h-24 object-contain" />
        </div>
      </header>

      {/* Main Split Content */}
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* LEFT SIDE: Image Box (Landscape Rectangle) */}
        <div className="lg:col-span-5 flex flex-col items-center space-y-6">
          <div
            className="relative w-full aspect-video bg-white rounded-xl shadow-inner border border-gray-200 flex items-center justify-center overflow-hidden p-6"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {isHovered ? (
              <img src={data.originalPath} alt="Original" className="max-w-full max-h-full object-contain shadow-xl" />
            ) : (
              <canvas
                ref={canvasRef}
                width={cols}
                height={rows}
                className="max-w-full max-h-full object-contain shadow-xl"
              />
            )}
          </div>

          <div className="w-full space-y-2 px-4">
            <div className="flex justify-between text-xs text-gray-500 uppercase tracking-widest font-bold">
              <span>Rank (k): {k}</span>
              <span>Max: {maxK}</span>
            </div>
            <input
              type="range" min="1" max={maxK} value={k}
              onChange={(e) => setK(parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-black"
            />
          </div>
        </div>

        {/* RIGHT SIDE: Graphs & Stats */}
        <div className="lg:col-span-7 flex flex-col space-y-6">

          {/* Top: Side-by-Side Graphs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-64">
              <p className="text-[10px] uppercase tracking-widest mb-4 text-gray-400 font-bold">Singular Values (Log)</p>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="index" hide />
                  <YAxis scale="log" domain={['auto', 'auto']} hide />
                  <Tooltip labelClassName="text-black" />
                  <Line type="monotone" dataKey="renderVal" stroke="#0ea5e9" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-64">
              <p className="text-[10px] uppercase tracking-widest mb-4 text-gray-400 font-bold">Cumulative Sum (%)</p>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="index" hide />
                  <YAxis domain={[0, 100]} fontSize={10} />
                  <Tooltip />
                  <Area type="monotone" dataKey="cumulative" stroke="#10b981" fill="#ecfdf5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom: Statistics Panels */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Energy Retained</p>
              <p className="text-4xl font-light text-slate-800">
                {((chartData[k-1]?.cumulative) || 100).toFixed(2)}<span className="text-xl">%</span>
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Compression Ratio</p>
              <p className="text-4xl font-light text-slate-800">
                {( (k * (rows + cols + 1)) / (rows * cols) ).toFixed(3)}
              </p>
            </div>
          </div>

          {/* <div className="bg-slate-800 text-white p-4 rounded-xl text-xs font-[lilex] leading-relaxed opacity-90">
             Note: $A_k = \sum_{i=1}^{k} \sigma_i u_i v_i^T$. Increasing $k$ adds more "principal components" back into the image.
          </div> */}
        </div>
      </main>
    </div>
  );
}