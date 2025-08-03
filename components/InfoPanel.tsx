import React from 'react';

const InfoPanel: React.FC = () => {
  return (
    <div className="p-6 border-t border-gray-700">
      <div className="mb-4">
        <h3 className="text-md font-bold text-gray-200 mb-3 border-b border-gray-700 pb-2">
          Support the Dev
        </h3>
        <div className="flex justify-center items-center py-1">
          <a href='https://ko-fi.com/K3K61IVAQ1' target='_blank' rel="noopener noreferrer">
            <img
              style={{ border: '0px', height: '36px' }}
              src='https://storage.ko-fi.com/cdn/kofi6.png?v=6'
              alt='Buy Me a Coffee at ko-fi.com'
            />
          </a>
        </div>
      </div>
      
      <div className="text-center text-xs text-gray-400">
        
        <img
          src="https://count.getloli.com/@babblingbook?name=babblingbook&theme=rule34&padding=7&offset=0&align=center&scale=0.7&pixelated=1&darkmode=auto"
          alt="Visitor count"
          className="mx-auto"
        />

          {/* Pulsante FramingBook centrato */}
        <div className="flex justify-center mt-4">
          <a
            href="https://framingbook.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-yellow-500 text-white font-bold py-2 px-4 rounded hover:bg-yellow-600 transition-colors"
          >
            FramingBook
          </a>
        </div>
        
      </div>
    </div>
  );
};

export default InfoPanel;
