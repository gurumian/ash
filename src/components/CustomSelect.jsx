import React, { useState, useEffect, useRef } from 'react';
import './CustomSelect.css';

/**
 * CustomSelect Component
 * A fully custom dropdown to replace native <select> for better styling control.
 * 
 * Props:
 * - value: current selected value
 * - onChange: callback(newValue)
 * - options: array of { value, label } objects or simple strings/numbers
 * - placeholder: text to show when no value is selected
 * - disabled: boolean
 * - name: string (for form integration identification if needed)
 * - id: string
 */
export const CustomSelect = ({
    value,
    onChange,
    options = [],
    placeholder = 'Select...',
    disabled = false,
    name,
    id
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Normalize options to { value, label } format
    const normalizedOptions = options.map(opt => {
        if (typeof opt === 'object' && opt !== null) {
            return { value: opt.value, label: opt.label || opt.value };
        }
        return { value: opt, label: opt };
    });

    const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));

    // Toggle dropdown
    const handleToggle = (e) => {
        e.preventDefault();
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    // Handle selection
    const handleSelect = (optionValue) => {
        // Treat numeric values as numbers if original value was number, but usually strings for form state
        // For consistency with native select onChange (which returns events), we'll return the value directly
        // adapting to the parent's expectation might be needed.
        // The previous native select passed an event { target: { name, value } }.
        // We will simulate that event structure for compatibility.

        const eventSim = {
            target: {
                name: name,
                value: optionValue
            }
        };

        onChange(eventSim);
        setIsOpen(false);
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div
            className="custom-select-container"
            ref={containerRef}
            id={id}
        >
            <div
                className={`custom-select-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={handleToggle}
            >
                <span className="custom-select-value">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="custom-select-arrow">▼</span>
            </div>

            {isOpen && (
                <div className="custom-select-options">
                    {normalizedOptions.length === 0 ? (
                        <div className="custom-select-option disabled" style={{ cursor: 'default', opacity: 0.7 }}>
                            No options
                        </div>
                    ) : (
                        normalizedOptions.map((opt, index) => (
                            <div
                                key={`${opt.value}-${index}`}
                                className={`custom-select-option ${String(opt.value) === String(value) ? 'selected' : ''}`}
                                onClick={() => handleSelect(opt.value)}
                            >
                                {opt.label}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
