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

const RoleSelection = ({ roleOptions, onRoleSelect, onBack }) => {
  return (
    <QueueLayout>
      <div className="h-full flex flex-col items-center justify-center">
        {/* Header */}
        <div className="mb-10">
          <h2 className="text-4xl font-semibold text-center drop-shadow-lg whitespace-nowrap" style={{ color: '#1F3463' }}>
            SELECT ROLE
          </h2>
        </div>

        {/* Responsive Grid Container */}
        <div className="w-full flex justify-center">
          <ResponsiveGrid
            items={roleOptions}
            onItemClick={(role) => onRoleSelect(role)}
            renderItem={(role) => (
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">
                  {role}
                </h3>
              </div>
            )}
            showPagination={roleOptions.length > 6}
          />
        </div>
      </div>

      <BackButton onBack={onBack} />
    </QueueLayout>
  );
};

export default React.memo(RoleSelection);








