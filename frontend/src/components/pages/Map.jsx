import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KioskLayout } from '../layouts';
import { FaSearch, FaWheelchair, FaPlus, FaMinus, FaExpand, FaSearchPlus, FaSearchMinus, FaTimes } from 'react-icons/fa';
import HolographicKeyboard from '../ui/HolographicKeyboard';



const Map = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('1F');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isAccessibilityActive, setIsAccessibilityActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapScale, setMapScale] = useState(1);
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  // Animation variants for staggered effects
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1
      }
    }
  };

  const searchBarVariants = {
    hidden: { opacity: 0, y: -30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.5
      }
    }
  };

  const mapDisplayVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.6,
        delay: 0.2
      }
    }
  };

  const controlsVariants = {
    hidden: { opacity: 0, x: 30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15,
        duration: 0.5,
        delay: 0.3
      }
    }
  };
  const mapContainerRef = useRef(null);
  const mapImageRef = useRef(null);
  const normalMapContainerRef = useRef(null);
  const normalMapImageRef = useRef(null);

  // Floor options for the dropdown
  const floorOptions = [
    { value: '1F', label: '1st Floor' },
    { value: '2F', label: '2nd Floor' },
    { value: '3F', label: '3rd Floor' },
    { value: '4F', label: '4th Floor' }
  ];

  // Department options for the dropdown
  const departmentOptions = [
    { value: '', label: 'Select Department' },
    { value: 'registrar', label: 'Registrar Office' },
    { value: 'admissions', label: 'Admissions Office' },
    { value: 'cashier', label: 'Cashier Office' },
    { value: 'library', label: 'Library' },
    { value: 'guidance', label: 'Guidance Office' },
    { value: 'clinic', label: 'Medical Clinic' },
    { value: 'canteen', label: 'Canteen' }
  ];

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleFloorChange = (e) => {
    setSelectedFloor(e.target.value);
  };

  const handleDepartmentChange = (e) => {
    setSelectedDepartment(e.target.value);
  };

  const handleSearch = () => {
    // Search functionality implementation
    console.log('Searching for:', searchTerm);
  };

  // Calculate pan boundaries to keep image visible
  const constrainPosition = (newX, newY, scale, containerRef, imageRef) => {
    if (!containerRef.current || !imageRef.current) return { x: newX, y: newY };

    const container = containerRef.current.getBoundingClientRect();
    const image = imageRef.current;
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;

    // Calculate scaled dimensions
    const scaledWidth = imageWidth * scale;
    const scaledHeight = imageHeight * scale;

    // Calculate max allowed translation
    const maxX = Math.max(0, (scaledWidth - container.width) / 2);
    const maxY = Math.max(0, (scaledHeight - container.height) / 2);

    // Constrain position
    const constrainedX = Math.max(-maxX, Math.min(maxX, newX));
    const constrainedY = Math.max(-maxY, Math.min(maxY, newY));

    return { x: constrainedX, y: constrainedY };
  };

  const handleZoomIn = () => {
    setMapScale(prev => {
      const newScale = Math.min(prev + 0.2, 3);
      // Constrain position after zoom
      const imageRef = isFullscreen ? mapImageRef : normalMapImageRef;
      const containerRef = isFullscreen ? mapContainerRef : normalMapContainerRef;
      const constrained = constrainPosition(mapPosition.x, mapPosition.y, newScale, containerRef, imageRef);
      setMapPosition(constrained);
      return newScale;
    });
  };

  const handleZoomOut = () => {
    setMapScale(prev => {
      // Dynamic minimum: stop at actual image size (1x)
      const newScale = Math.max(prev - 0.2, 1);
      // Constrain position after zoom
      const imageRef = isFullscreen ? mapImageRef : normalMapImageRef;
      const containerRef = isFullscreen ? mapContainerRef : normalMapContainerRef;
      const constrained = constrainPosition(mapPosition.x, mapPosition.y, newScale, containerRef, imageRef);
      setMapPosition(constrained);
      return newScale;
    });
  };

  const handleFullscreen = () => {
    setIsFullscreen(true);
    setMapScale(1);
    setMapPosition({ x: 0, y: 0 });
  };

  const handleExitFullscreen = () => {
    setIsFullscreen(false);
    setMapScale(1);
    setMapPosition({ x: 0, y: 0 });
  };

  const handleAccessibility = () => {
    setIsAccessibilityActive(prev => !prev);
  };

  // Dragging handlers for map (works in both normal and fullscreen)
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - mapPosition.x,
      y: e.clientY - mapPosition.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    const imageRef = isFullscreen ? mapImageRef : normalMapImageRef;
    const containerRef = isFullscreen ? mapContainerRef : normalMapContainerRef;
    const constrained = constrainPosition(newX, newY, mapScale, containerRef, imageRef);
    setMapPosition(constrained);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - mapPosition.x,
      y: touch.clientY - mapPosition.y
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStart.x;
    const newY = touch.clientY - dragStart.y;

    const imageRef = isFullscreen ? mapImageRef : normalMapImageRef;
    const containerRef = isFullscreen ? mapContainerRef : normalMapContainerRef;
    const constrained = constrainPosition(newX, newY, mapScale, containerRef, imageRef);
    setMapPosition(constrained);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Cleanup dragging on unmount
  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    setShowKeyboard(true);
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
  };

  const hideKeyboard = () => {
    setShowKeyboard(false);
    setIsSearchFocused(false);
  };

  // Keyboard handling functions
  const handleKeyPress = (key) => {
    setSearchTerm(prev => prev + key);
  };

  const handleBackspace = () => {
    setSearchTerm(prev => prev.slice(0, -1));
  };

  const handleSpace = () => {
    setSearchTerm(prev => prev + ' ');
  };

  return (
    <>
      <KioskLayout>
        <motion.div
          className="h-full flex flex-col overflow-hidden"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Search Bar at Top */}
          <motion.div
            className="rounded-3xl mb-2 flex justify-center flex-shrink-0"
            variants={searchBarVariants}
          >
            <div className="w-3/5 flex gap-2.5 items-center">
              <div className="flex-grow">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  placeholder="Search for rooms, departments, or facilities..."
                  className={`w-full px-3 py-2 border-2 rounded-3xl text-base focus:outline-none transition-colors shadow-lg focus:shadow-xl ${
                    isSearchFocused
                      ? 'border-[#1F3463] bg-blue-50'
                      : 'border-gray-300 active:border-gray-400'
                  }`}
                  // TEMPORARY: readOnly removed for testing - restore for production
                />
              </div>
              <button
                onClick={handleSearch}
                className="bg-[#FFE251] text-[#1A2E56] px-4 py-2 rounded-3xl transition-all duration-150 focus:outline-none flex items-center gap-1.5 shadow-lg active:shadow-md active:scale-95 drop-shadow-md"
              >
                <FaSearch className="w-3.5 h-3.5" />
                <span className="font-semibold text-sm">Search</span>
              </button>


            </div>
          </motion.div>

          {/* Map Display */}
          <motion.div
            className="flex-grow bg-white rounded-lg shadow-xl drop-shadow-lg p-4 mb-1.5 overflow-hidden"
            variants={mapDisplayVariants}
          >
            <div
              ref={normalMapContainerRef}
              className="w-full h-full flex items-center justify-center relative overflow-hidden cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                ref={normalMapImageRef}
                src="/map/1F.jpg"
                alt="1st Floor Map"
                className="max-w-full max-h-full object-contain rounded-lg shadow-sm select-none"
                style={{
                  transform: `scale(${mapScale}) translate(${mapPosition.x / mapScale}px, ${mapPosition.y / mapScale}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                  touchAction: 'none'
                }}
                draggable={false}
              />
            </div>
          </motion.div>

          {/* Control Panel */}
          <motion.div
            className="rounded-lg p-2 flex-shrink-0"
            variants={controlsVariants}
          >
            <div className="grid grid-cols-3 gap-2.5 items-end">
              {/* Column 1 - Department Selector */}
              <div>
                <div className="relative">
                  <select
                    id="department"
                    value={selectedDepartment}
                    onChange={handleDepartmentChange}
                    className="w-full px-2.5 py-2 pr-8 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-[#1F3463] focus:border-[#1F3463] outline-none bg-white text-base h-9 appearance-none cursor-pointer shadow-lg focus:shadow-xl"
                  >
                    {departmentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {/* Custom Dropdown Arrow */}
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Column 2 - Floor Level Selector */}
              <div>
                <div className="relative">
                  <select
                    id="floor"
                    value={selectedFloor}
                    onChange={handleFloorChange}
                    className="w-full px-2.5 py-2 pr-8 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-[#1F3463] focus:border-[#1F3463] outline-none bg-white text-base h-9 appearance-none cursor-pointer shadow-lg focus:shadow-xl"
                  >
                    {floorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {/* Custom Dropdown Arrow */}
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Column 3 - Map Controls */}
              <div>
                <div className="flex h-9 shadow-lg drop-shadow-md rounded-2xl overflow-hidden">
                  <button
                    onClick={handleAccessibility}
                    className={`flex-1 px-2 py-2 active:scale-95 transition-all duration-150 focus:outline-none flex items-center justify-center gap-1 border-r border-[#1A2E56] ${
                      isAccessibilityActive
                        ? 'bg-[#FFE251] text-[#1F3463]'
                        : 'bg-[#1F3463] text-white active:bg-[#1A2E56]'
                    }`}
                    title="Priority Accessible Route"
                    aria-label="Toggle priority accessible route"
                  >
                    <FaWheelchair className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleZoomIn}
                    className="flex-1 bg-[#1F3463] text-white px-2 py-2 active:bg-[#1A2E56] active:scale-95 transition-all duration-150 focus:outline-none flex items-center justify-center gap-1 border-r border-[#1A2E56] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Zoom In"
                    disabled={mapScale >= 3}
                  >
                    <FaSearchPlus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="flex-1 bg-[#1F3463] text-white px-2 py-2 active:bg-[#1A2E56] active:scale-95 transition-all duration-150 focus:outline-none flex items-center justify-center gap-1 border-r border-[#1A2E56] disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Zoom Out"
                    disabled={mapScale <= 1}
                  >
                    <FaSearchMinus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleFullscreen}
                    className="flex-1 bg-[#1F3463] text-white px-2 py-2 active:bg-[#1A2E56] active:scale-95 transition-all duration-150 focus:outline-none flex items-center justify-center"
                    title="Fullscreen"
                  >
                    <FaExpand className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

        </motion.div>

        {/* Holographic Keyboard Overlay */}
        <HolographicKeyboard
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          onSpace={handleSpace}
          onHide={hideKeyboard}
          isVisible={showKeyboard}
          activeInputValue={searchTerm}
          activeInputLabel="SEARCH"
          activeInputPlaceholder="Search for rooms, departments, or facilities..."
        />
      </KioskLayout>

      {/* Fullscreen Map View - Minimalist Design */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-95 backdrop-blur-sm">
          {/* Fullscreen Map Container */}
          <div
            ref={mapContainerRef}
            className="w-full h-full relative overflow-hidden cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-full h-full flex items-center justify-center p-6">
              <img
                ref={mapImageRef}
                src="/map/1F.jpg"
                alt="1st Floor Map - Fullscreen"
                className="max-w-full max-h-full object-contain select-none"
                style={{
                  transform: `scale(${mapScale}) translate(${mapPosition.x / mapScale}px, ${mapPosition.y / mapScale}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                  touchAction: 'none'
                }}
                draggable={false}
              />
            </div>

            {/* Floating Exit Button - Top Right */}
            <button
              onClick={handleExitFullscreen}
              className="absolute top-5 right-5 bg-[#1F3463] text-white p-3 rounded-2xl shadow-2xl hover:bg-[#FFE251] hover:text-[#1F3463] active:scale-95 transition-all duration-200 z-10"
              title="Exit Fullscreen"
            >
              <FaTimes className="w-6 h-6" />
            </button>

            {/* Floating Zoom Controls - Bottom Right */}
            <div className="absolute bottom-5 right-5 flex flex-col gap-2.5 z-10">
              {/* Zoom Percentage Display */}
              <div className="bg-white bg-opacity-95 text-[#1F3463] px-4 py-2.5 rounded-2xl shadow-2xl text-center">
                <span className="text-xl font-bold">{Math.round(mapScale * 100)}%</span>
              </div>

              {/* Zoom In Button */}
              <button
                onClick={handleZoomIn}
                className="bg-[#1F3463] text-white p-3 rounded-2xl shadow-2xl hover:bg-[#FFE251] hover:text-[#1F3463] active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1F3463] disabled:hover:text-white"
                disabled={mapScale >= 3}
                title="Zoom In"
              >
                <FaSearchPlus className="w-6 h-6" />
              </button>

              {/* Zoom Out Button */}
              <button
                onClick={handleZoomOut}
                className="bg-[#1F3463] text-white p-3 rounded-2xl shadow-2xl hover:bg-[#FFE251] hover:text-[#1F3463] active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#1F3463] disabled:hover:text-white"
                disabled={mapScale <= 1}
                title="Zoom Out"
              >
                <FaSearchMinus className="w-6 h-6" />
              </button>
            </div>

            {/* Helper Text Overlay - Bottom Left */}
            <div className="absolute bottom-5 left-5 bg-white bg-opacity-90 px-4 py-2.5 rounded-2xl shadow-2xl z-10">
              <p className="text-xs text-[#1F3463] font-semibold">
                Drag to pan • Pinch to zoom
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Map;
