import React from 'react';
import * as C from "../utils/utils";
import circleImg from '../assets/circle.png';
import ellipseImg from '../assets/ellipse.png';

export default function Menu({ onSelect }) {

  return (
    <div className='min-h-screen bg-[#f4f3ef] flex flex-col items-center py-6 px-4'>
      {/* Header Section */}
      <header className='w-full flex flex-col items-center text-center mb-12 mt-4 px-4'>
        <div className='flex items-center justify-center gap-2 md:gap-4 lg:gap-10 w-full'>

          {/* Left Image: Circle */}
          <img
            src={circleImg}
            alt="Unit Circle"
            className="hidden md:block w-32 h-32 lg:w-42 lg:h-42 object-contain"
          />

          {/* Main Title Content */}
          <div className="flex flex-col items-center shrink-0">
            <h1 className='text-4xl md:text-5xl lg:text-6xl font-light mb-0 font-[Vend_Sans]'>
              SVD Image Compression
            </h1>
            <div className='w-12 h-px bg-gray-400 my-4'></div>
            <p className='text-gray-600 max-w-md md:max-w-lg text-lg leading-relaxed font-[lilex]'>
              An interactive visualization of image compression using singular value decomposition.
            </p>
          </div>

          {/* Right Image: Ellipse */}
          <img
            src={ellipseImg}
            alt="Transformed Ellipse"
            className="hidden md:block w-32 h-32 lg:w-42 lg:h-42 object-contain"
          />

        </div>
      </header>

      {/* Section 1: Portfolio */}
      <section className='w-full max-w-5xl mb-4'>
        <h2 className='text-xl font-medium text-gray-800 mb-6 text-center uppercase tracking-widest font-[Red_Hat_Display]'>
          Explore our Portfolio
        </h2>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-6'>
          {C.portfolioImages.map((img, index) => (
            <div
              key={index}
              className='group cursor-pointer flex flex-col items-center'
              onClick={() => onSelect(img)} // Trigger the load
            >
              <div className='overflow-hidden rounded-lg shadow-sm group-hover:shadow-xl transition-all duration-300 transform group-hover:-translate-y-2'>
                <img
                  src={img.path}
                  alt={img.name}
                  className='w-full h-48 object-cover'
                />
              </div>
              <span className='mt-0 text-sm text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity'>
                Select {img.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Upload */}
      <section className='w-full max-w-md flex flex-col items-center border-t border-gray-200 pt-6 mb-8'>
        <h2 className='text-xl font-medium text-gray-800 mb-6 uppercase tracking-widest font-[Red_Hat_Display]'>
          Upload your own image
        </h2>

        <label className='group cursor-pointer flex items-center justify-center gap-3 bg-white border border-gray-300 px-8 py-4 rounded-full shadow-sm hover:shadow-md hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 active:scale-95'>
          {/* The Upload Icon */}
          <i className="fa-solid fa-upload text-gray-600 group-hover:text-black transition-colors"></i>

          <span className='text-gray-700 font-medium group-hover:text-black'>
            Upload File
          </span>
          {/* Hidden File Input */}
          <input
            type='file'
            className='hidden'
            accept='.png, .jpg, .jpeg'
            onChange={(e) => console.log(e.target.files[0])}
          />
        </label>
      </section>

      {/* Footer */}
      <footer className='mt-auto pt-2 text-center'>
        <p className='text-gray-500 text-sm'>
          Website made by <a href='https://www.linkedin.com/in/hisham-bhatti/' className="text-sky-600 hover:underline"
              target="_blank">Hisham Bhatti</a>.
          See <a href='https://github.com/hishambhatti/image-compression-svd' className="text-sky-600 hover:underline"
              target="_blank">Github</a> for code and mathematical formalism.
        </p>
      </footer>
    </div>


  );
}