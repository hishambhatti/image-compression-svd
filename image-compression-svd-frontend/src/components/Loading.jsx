import React from 'react';

export default function Loading({ info }) {
  const showDownsample =
    info?.wasDownsampled &&
    info.originalWidth &&
    info.originalHeight;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f4f3ef] text-gray-700 font-[Red_Hat_Display] z-50">
      <div className="w-10 h-10 border-4 border-[#3498DB] border-t-transparent rounded-full animate-spin mb-4" />

      <h1 className="text-2xl font-medium tracking-wide mb-2">
        Calculating SVD…
      </h1>

      {showDownsample && (
        <div className="mt-2 text-sm text-gray-500 text-center max-w-md">
          <p>
            Image size{" "}
            <span className="font-medium text-gray-700">
              ({info.originalWidth} × {info.originalHeight})
            </span>{" "}
            exceeds limit
          </p>
          <p>
            Downsampling to{" "}
            <span className="font-medium text-gray-700">
              {info.finalWidth} × {info.finalHeight}
            </span>{" "}
            for faster computation
          </p>
        </div>
      )}
    </div>
  );
}
