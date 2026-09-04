import React, { useState, useEffect, useRef } from 'react';

interface CustomDropdownProps {
  options: {value: string, label: string}[];
  selectedValue: string;
  setSelectedValue: (v: string) => void;
  placeholder: string;
  direction?: 'up' | 'down';
  width?: string;
  disabled?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({ 
  options, 
  selectedValue, 
  setSelectedValue, 
  placeholder,
  direction = 'down',
  width = '100%',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const selectedLabel = selectedValue ? options.find(o => o.value === selectedValue)?.label || selectedValue : placeholder;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width, opacity: disabled ? 0.6 : 1 }}>
      <div 
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        className="select-input"
        style={{ 
          cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF', fontSize: '14px', fontWeight: 600, color: '#0F172A', minHeight: '44px',
          userSelect: 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64748B' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      
      {isOpen && !disabled && (
        <div style={{
          position: 'absolute',
          ...(direction === 'up' ? { bottom: '100%', marginBottom: '4px' } : { top: '100%', marginTop: '4px' }),
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
          border: '1px solid #CBD5E1',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          maxHeight: '450px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div 
            onClick={() => { setSelectedValue(""); setIsOpen(false); }}
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '14px', borderBottom: '1px solid #F1F5F9', color: '#64748B' }}
          >
            {placeholder}
          </div>
          {options.map(opt => (
            <div
              key={opt.value}
              onClick={() => {
                setSelectedValue(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: selectedValue === opt.value ? '#2563EB' : '#FFFFFF',
                color: selectedValue === opt.value ? '#FFFFFF' : '#0F172A',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => { if (selectedValue !== opt.value) e.currentTarget.style.backgroundColor = '#F8FAFC' }}
              onMouseLeave={(e) => { if (selectedValue !== opt.value) e.currentTarget.style.backgroundColor = '#FFFFFF' }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
