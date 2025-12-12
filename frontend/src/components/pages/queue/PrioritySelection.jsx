import React from 'react';
import { motion } from 'framer-motion';
import QueueLayout from '../../layouts/QueueLayout';
import { ResponsiveGrid } from '../../ui';

const BackButton = ({ onBack }) => (
  <button
    onClick={onBack}
    className="absolute bottom-6 left-6 w-16 h-16 rounded-full border-2 border-white bg-[#1F3463] text-white font-bold text-xs active:bg-[#1A2E56] transition-all duration-150 shadow-lg active:shadow-md active:scale-95 flex items-center justify-center"
  >
    BACK
  </button>
);

const PrioritySelection = ({ priorityOptions, onPrioritySelect, onBack }) => {
  return (
    <QueueLayout>
      <div className="h-full flex flex-col items-center justify-center">
        {/* Header */}
        <div className="mb-10">
          <h2 className="text-4xl font-semibold text-center drop-shadow-lg whitespace-nowrap mb-3" style={{ color: '#1F3463' }}>
            DO YOU BELONG TO THE FOLLOWING?
          </h2>
          {/* Subheader with side-by-side layout and images */}
          <div className="flex items-start justify-center gap-8 text-2xl font-semibold text-center drop-shadow-lg mt-8" style={{ color: '#1F3463' }}>
            <div className="flex flex-col items-center">
              <img
                src="/queue/pwd.png"
                alt="Person with Disabilities"
                className="mb-2 h-16 w-auto object-contain"
              />
              <div>PERSON WITH <br></br>DISABILITIES (PWD)</div>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="/queue/senior.png"
                alt="Senior Citizen"
                className="mb-2 h-16 w-auto object-contain"
              />
              <div>SENIOR CITIZEN</div>
            </div>
          </div>
        </div>

        {/* Responsive Grid Container */}
        <div className="w-full flex justify-center">
          <ResponsiveGrid
            items={priorityOptions}
            onItemClick={(option) => onPrioritySelect(option.key)}
            renderItem={(option) => (
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">
                  {option.label}
                </h3>
              </div>
            )}
            showPagination={priorityOptions.length > 6}
          />
        </div>
      </div>

      <BackButton onBack={onBack} />
    </QueueLayout>
  );
};

export default React.memo(PrioritySelection);












