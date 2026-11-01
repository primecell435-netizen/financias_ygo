/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { parseCurrencyInput, formatCurrencyForDisplay } from '../../utils/formatters';

interface CurrencyInputProps {
  value: number | '';
  onChange: (numericValue: number | '', rawText: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  max?: number;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = '0,00',
  className = '',
  required = false,
  disabled = false,
  id,
  name,
  autoFocus = false,
  max,
}) => {
  const [text, setText] = useState<string>(() => {
    if (value === '' || value === undefined || value === null) return '';
    return formatCurrencyForDisplay(value);
  });
  const [isFocused, setIsFocused] = useState(false);

  // Sync when external numeric value changes while not focused
  useEffect(() => {
    if (!isFocused) {
      if (value === '' || value === undefined || value === null) {
        setText('');
      } else {
        setText(formatCurrencyForDisplay(value));
      }
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    if (raw.trim() === '') {
      onChange('', '');
      return;
    }

    const parsed = parseCurrencyInput(raw);
    if (max !== undefined && parsed > max) {
      onChange(max, String(max));
    } else {
      onChange(parsed, raw);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (text.trim() === '') {
      onChange('', '');
      setText('');
      return;
    }
    const parsed = parseCurrencyInput(text);
    if (parsed > 0) {
      setText(formatCurrencyForDisplay(parsed));
      onChange(parsed, formatCurrencyForDisplay(parsed));
    } else {
      setText('');
      onChange('', '');
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // If text is formatted like "300,00", user can keep editing or leave as is
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      required={required}
      disabled={disabled}
      id={id}
      name={name}
      autoFocus={autoFocus}
    />
  );
};
