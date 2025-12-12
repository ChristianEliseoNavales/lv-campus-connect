import React, { useRef, useEffect, useState } from 'react';
import { MdFormatBold, MdFormatItalic, MdFormatUnderlined, MdTextFields, MdFormatIndentIncrease, MdFormatIndentDecrease } from 'react-icons/md';

const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Enter text...',
  error = false,
  maxLength = 2000,
  rows = 5
}) => {
  const editorRef = useRef(null);
  const [textLength, setTextLength] = useState(0);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    fontSize: null
  });

  // Update text length when value changes
  useEffect(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      setTextLength(text.length);
    }
  }, [value]);

  // Update editor content when value prop changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Check active formats
  const checkActiveFormats = () => {
    if (!editorRef.current) return;

    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;
    let element = startContainer.nodeType === Node.TEXT_NODE
      ? startContainer.parentElement
      : startContainer;

    if (element === editorRef.current) {
      const focusNode = selection.focusNode;
      if (focusNode && focusNode !== editorRef.current) {
        element = focusNode.nodeType === Node.TEXT_NODE
          ? focusNode.parentElement
          : focusNode;
      }
    }

    if (!element) return;

    // Check bold, italic, underline
    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');

    // Check font size
    let fontSize = null;
    const computedStyle = window.getComputedStyle(element);
    const size = computedStyle.fontSize;
    if (size) {
      const sizeNum = parseInt(size);
      if (sizeNum >= 12 && sizeNum <= 24) {
        fontSize = sizeNum;
      }
    }

    setActiveFormats({
      bold: isBold,
      italic: isItalic,
      underline: isUnderline,
      fontSize
    });
  };

  const handleInput = (e) => {
    const html = e.target.innerHTML;
    const text = e.target.innerText || '';
    setTextLength(text.length);

    if (onChange) {
      onChange(html, text.length);
    }
  };

  const handleSelectionChange = () => {
    checkActiveFormats();
  };

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  const handleFormat = (command, value = null) => {
    if (!editorRef.current) return;

    editorRef.current.focus();

    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    try {
      // Use execCommand for formatting
      if (value !== null) {
        document.execCommand(command, false, value);
      } else {
        document.execCommand(command, false);
      }

      // Restore focus and update
      editorRef.current.focus();
      const html = editorRef.current.innerHTML;
      const text = editorRef.current.innerText || '';
      setTextLength(text.length);

      if (onChange) {
        onChange(html, text.length);
      }

      // Update active formats
      setTimeout(checkActiveFormats, 10);
    } catch (error) {
      console.error('[RichTextEditor] Error executing format command:', error);
    }
  };

  const handleFontSize = (size) => {
    if (!editorRef.current) return;

    editorRef.current.focus();

    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // If no selection, select the current word or create a span at cursor
    if (range.collapsed) {
      // Expand to word boundaries
      range.expand('word');
    }

    // Create span with font size
    const span = document.createElement('span');
    span.style.fontSize = `${size}px`;

    try {
      if (!range.collapsed) {
        // Wrap selected content
        try {
          range.surroundContents(span);
        } catch (e) {
          // If surroundContents fails, extract and wrap
          const contents = range.extractContents();
          span.appendChild(contents);
          range.insertNode(span);
        }
      } else {
        // Insert span at cursor for future typing
        range.insertNode(span);
        // Move cursor inside span
        range.setStart(span, 0);
        range.setEnd(span, 0);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (error) {
      console.error('Error applying font size:', error);
    }

    editorRef.current.focus();
    const html = editorRef.current.innerHTML;
    const text = editorRef.current.innerText || '';
    setTextLength(text.length);

    if (onChange) {
      onChange(html, text.length);
    }

    setTimeout(checkActiveFormats, 10);
  };

  const fontSizes = [12, 14, 16, 18, 20, 24];

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 sm:gap-1.5 mb-2 p-1.5 sm:p-2 border border-gray-200 rounded-lg bg-gray-50">
        {/* Bold */}
        <button
          type="button"
          onClick={() => handleFormat('bold')}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            activeFormats.bold
              ? 'bg-[#1F3463] text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
          title="Bold"
        >
          <MdFormatBold className="text-sm sm:text-base" />
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => handleFormat('italic')}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            activeFormats.italic
              ? 'bg-[#1F3463] text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
          title="Italic"
        >
          <MdFormatItalic className="text-sm sm:text-base" />
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => handleFormat('underline')}
          className={`p-1.5 sm:p-2 rounded transition-colors ${
            activeFormats.underline
              ? 'bg-[#1F3463] text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
          title="Underline"
        >
          <MdFormatUnderlined className="text-sm sm:text-base" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300 mx-0.5" />

        {/* Indent */}
        <button
          type="button"
          onClick={() => handleFormat('indent')}
          className="p-1.5 sm:p-2 rounded transition-colors bg-white text-gray-700 hover:bg-gray-100"
          title="Increase Indent"
        >
          <MdFormatIndentIncrease className="text-sm sm:text-base" />
        </button>

        {/* Reduce Indent */}
        <button
          type="button"
          onClick={() => handleFormat('outdent')}
          className="p-1.5 sm:p-2 rounded transition-colors bg-white text-gray-700 hover:bg-gray-100"
          title="Decrease Indent"
        >
          <MdFormatIndentDecrease className="text-sm sm:text-base" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300 mx-0.5" />

        {/* Font Size */}
        <div className="relative group">
          <button
            type="button"
            className="p-1.5 sm:p-2 rounded transition-colors bg-white text-gray-700 hover:bg-gray-100 flex items-center gap-1"
            title="Font Size"
          >
            <MdTextFields className="text-sm sm:text-base" />
            <span className="text-xs sm:text-sm font-medium">
              {activeFormats.fontSize ? `${activeFormats.fontSize}px` : 'Size'}
            </span>
          </button>

          {/* Font Size Dropdown */}
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
            <div className="p-1">
              {fontSizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleFontSize(size)}
                  className={`w-full text-left px-2.5 py-1.5 text-xs sm:text-sm rounded transition-colors ${
                    activeFormats.fontSize === size
                      ? 'bg-[#1F3463] text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={checkActiveFormats}
        onClick={checkActiveFormats}
        onKeyUp={checkActiveFormats}
        className={`w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded-lg focus:outline-none focus:ring-2 rich-text-editor ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:ring-[#1F3463]'
        }`}
        style={{
          minHeight: `${rows * 1.5}rem`,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Placeholder styling */}
      <style>{`
        .rich-text-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>

      {/* Character Counter */}
      <div className="flex justify-end mt-1">
        <p className="text-[10px] sm:text-xs text-gray-500">
          {textLength}/{maxLength} characters
        </p>
      </div>
    </div>
  );
};

export default RichTextEditor;




